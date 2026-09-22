import bcrypt from 'bcryptjs'
import * as crypto from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { hashEmail, hashToken, encryptEmail, decryptEmail, encryptValue } from '../utils/crypto.js'
import { sendPasswordResetEmail } from '../utils/mail.js'
import { rateLimitError } from '../utils/rate-limit.js'
import { evaluatePassword, weakPasswordMessage } from '../utils/passwordStrength.js'
import { clearSession, issueSession } from '../utils/session.js'
import { CATEGORY_USAGE } from './categories.js'

const errorSchema = {
  type: 'object',
  properties: { error: { type: 'string' }, code: { type: 'string' } },
}

const BCRYPT_ROUNDS = 12

/**
 * Hash factice (même coût que les vrais) comparé quand l'email est inconnu :
 * sans cela, un login inconnu répond en ~2 ms contre ~250 ms pour un mot de
 * passe faux, ce qui permet de deviner quels emails ont un compte.
 */
const DUMMY_HASH = '$2a$12$PvaWRBTwvUlA22IMpdyoHucAr78DS1Xt2RehoByoNf2f762fkCgs6'

/** Catégories créées avec le compte — modifiables ensuite depuis le profil. */
export const DEFAULT_CATEGORIES = [
  { name: 'Alimentation', color: '#4dde93' },
  { name: 'Transport',    color: '#488efe' },
  { name: 'Logement',     color: '#a78bfa' },
  { name: 'Santé',        color: '#f87171' },
  { name: 'Loisirs',      color: '#facc15' },
  { name: 'Abonnements',  color: '#38bdf8' },
  { name: 'Épargne',      color: '#2dd4bf' },
  { name: 'Divers',       color: '#94a3b8' },
]

/** Inscription : 20 comptes par heure et par IP (chaque création coûte un bcrypt). */
const REGISTER_LIMIT = { max: 20, timeWindow: '1 hour' }
/** Connexion : 10 essais par quart d'heure pour un même couple IP + email (force brute)… */
const LOGIN_LIMIT = { max: 10, timeWindow: '15 minutes' }
/** …et 60 par IP tous emails confondus (balayage d'une liste d'emails : chaque essai coûte ~250 ms de CPU). */
const LOGIN_IP_LIMIT = { max: 60, timeWindow: '15 minutes' }
/** Mot de passe oublié : 5 demandes par heure pour un même couple IP + email (éviter de spammer une boîte)… */
const FORGOT_PASSWORD_LIMIT = { max: 5, timeWindow: '1 hour' }
/** …et 20 par IP tous emails confondus. */
const FORGOT_PASSWORD_IP_LIMIT = { max: 20, timeWindow: '1 hour' }
/** Réinitialisation : le jeton a 256 bits d'entropie, indevinable — simple défense en profondeur. */
const RESET_PASSWORD_IP_LIMIT = { max: 20, timeWindow: '1 hour' }
/** Durée de validité d'un lien de réinitialisation. */
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000

/** Identifiants envoyés à l'inscription et à la connexion. */
interface Credentials {
  email: string
  password: string
}

/**
 * Retire les espaces qui entourent l'email avant la validation AJV (`format: 'email'` les refuse
 * tel quel — un copier-coller en garde facilement un). Le front les retire déjà de son côté, mais
 * un appel direct à l'API (script, Swagger) ne bénéficie pas de cette étape.
 */
function trimEmail(req: FastifyRequest, _reply: FastifyReply, done: (err?: Error) => void) {
  const body = req.body as { email?: unknown } | undefined
  if (body && typeof body.email === 'string') body.email = body.email.trim()
  done()
}

export default async function authRoutes(fastify: FastifyInstance) {
  const loginByIp = fastify.createRateLimit({
    ...LOGIN_IP_LIMIT,
    keyGenerator: (req: FastifyRequest) => `login-ip:${req.ip}`,
  })
  const loginByAccount = fastify.createRateLimit({
    ...LOGIN_LIMIT,
    keyGenerator: (req: FastifyRequest) => `login:${req.ip}:${String((req.body as Partial<Credentials> | undefined)?.email ?? '').toLowerCase().trim()}`,
  })
  const forgotPasswordByIp = fastify.createRateLimit({
    ...FORGOT_PASSWORD_IP_LIMIT,
    keyGenerator: (req: FastifyRequest) => `forgot-ip:${req.ip}`,
  })
  const forgotPasswordByAccount = fastify.createRateLimit({
    ...FORGOT_PASSWORD_LIMIT,
    keyGenerator: (req: FastifyRequest) => `forgot:${req.ip}:${String((req.body as { email?: string } | undefined)?.email ?? '').toLowerCase().trim()}`,
  })
  const resetPasswordByIp = fastify.createRateLimit({
    ...RESET_PASSWORD_IP_LIMIT,
    keyGenerator: (req: FastifyRequest) => `reset-ip:${req.ip}`,
  })

  /** Hook qui compte la requête et répond 429 quand le limiteur est dépassé. */
  const enforce = (check: typeof loginByIp) => async (req: FastifyRequest, reply: FastifyReply) => {
    const limit = await check(req)
    if (!limit.isAllowed && limit.isExceeded) {
      reply.header('retry-after', limit.ttlInSeconds)
      throw rateLimitError(limit.ttl)
    }
  }

  // ── POST /api/auth/register ─────────────────────────────
  fastify.post<{ Body: Credentials }>('/api/auth/register', {
    config: {
      rateLimit: { ...REGISTER_LIMIT, keyGenerator: (req: FastifyRequest) => `register:${req.ip}` },
    },
    preValidation: trimEmail,
    schema: {
      summary: 'Créer un compte utilisateur',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email:    { type: 'string', format: 'email', description: 'Adresse email' },
          password: { type: 'string', minLength: 8, maxLength: 72, description: 'Mot de passe (8 à 72 caractères — bcrypt ignore la suite)' },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id:        { type: 'string', format: 'uuid' },
            email:     { type: 'string', description: 'Email en clair (réponse uniquement, jamais stocké)' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        400: errorSchema,
        409: {
          type: 'object',
          properties: { error: { type: 'string' }, code: { type: 'string' } },
        },
      },
    },
  }, async (req, reply) => {
    const { email, password } = req.body
    const cleanEmail = email.toLowerCase().trim()

    // Robustesse : mêmes règles que le front (utils/passwordStrength.ts), imposées ici pour de bon —
    // un client qui contourne le formulaire ne peut pas créer de compte avec un mot de passe faible.
    const strength = evaluatePassword(password)
    if (!strength.acceptable) {
      return reply.code(400).send({ error: weakPasswordMessage(strength), code: 'WEAK_PASSWORD' })
    }

    // Blind index pour la recherche (HMAC-SHA256, jamais réversible)
    const emailHash = hashEmail(cleanEmail)

    // Vérifier unicité via le blind index
    const existing = await fastify.prisma.user.findUnique({
      where:  { emailHash },
      select: { id: true },
    })

    if (existing) {
      return reply.code(409).send({
        error: 'Cette adresse email est déjà utilisée.',
        code:  'EMAIL_ALREADY_EXISTS',
      })
    }

    // Chiffrer l'email pour stockage (AES-256-GCM, IV aléatoire)
    const emailEncrypted = encryptEmail(cleanEmail)

    // Hash du mot de passe
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    const user = await fastify.prisma.user.create({
      data:   { emailHash, emailEncrypted, passwordHash },
      select: { id: true, createdAt: true },
    })

    // Un compte vide est inutilisable : on amorce les catégories par défaut.
    await fastify.prisma.category.createMany({
      data: DEFAULT_CATEGORIES.map((category, position) => ({
        userId:        user.id,
        nameEncrypted: encryptValue(category.name, CATEGORY_USAGE),
        color:         category.color,
        position,
      })),
    })

    return reply.code(201).send({
      id:        user.id,
      email:     cleanEmail,   // renvoyé en clair dans la réponse, jamais stocké en clair
      createdAt: user.createdAt,
    })
  })

  // ── POST /api/auth/login ────────────────────────────────
  fastify.post<{ Body: Credentials }>('/api/auth/login', {
    // Deux limiteurs manuels : le plugin n'applique qu'un seul limiteur « de route » par requête.
    onRequest:  enforce(loginByIp),
    preValidation: trimEmail,
    preHandler: enforce(loginByAccount), // après parsing : c'est là que l'email est lisible
    schema: {
      summary: 'Authentifier un utilisateur',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email:    { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            // Le jeton de session part en cookie httpOnly (Set-Cookie), jamais dans ce corps.
            csrfToken: { type: 'string', description: 'À renvoyer dans l\'en-tête X-CSRF-Token sur toute requête qui modifie des données' },
            user:  {
              type: 'object',
              properties: {
                id:    { type: 'string', format: 'uuid' },
                email: { type: 'string' },
              },
            },
          },
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' }, code: { type: 'string' } },
        },
        429: {
          type: 'object',
          properties: { error: { type: 'string' }, code: { type: 'string' } },
        },
      },
    },
  }, async (req, reply) => {
    const { email, password } = req.body
    const cleanEmail = email.toLowerCase().trim()

    // Lookup via blind index uniquement
    const user = await fastify.prisma.user.findUnique({
      where:  { emailHash: hashEmail(cleanEmail) },
      select: {
        id:             true,
        emailEncrypted: true,
        passwordHash:   true,
        tokenVersion:   true,
      },
    })

    // Toujours un bcrypt.compare, même sans utilisateur : temps de réponse constant
    const isValid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH)
    if (!user || !isValid) {
      return reply.code(401).send({
        error: 'Email ou mot de passe incorrect.',
        code:  'INVALID_CREDENTIALS',
      })
    }

    // Déchiffrer l'email pour le JWT et la réponse
    const decryptedEmail = decryptEmail(user.emailEncrypted)

    const { csrfToken } = issueSession(fastify, reply, {
      id: user.id, email: decryptedEmail, tokenVersion: user.tokenVersion,
    })

    return reply.code(200).send({
      csrfToken,
      user: { id: user.id, email: decryptedEmail },
    })
  })

  // ── POST /api/auth/forgot-password ──────────────────────
  // Toujours 200, que l'adresse existe ou non : contrairement à l'inscription (409 assumé — voir
  // ARCHITECTURE.md), rien ici ne justifie de révéler l'existence d'un compte. Seul le titulaire de
  // la boîte mail l'apprend, via l'email lui-même (ou son absence).
  fastify.post<{ Body: { email: string } }>('/api/auth/forgot-password', {
    onRequest:  enforce(forgotPasswordByIp),
    preValidation: trimEmail,
    preHandler: enforce(forgotPasswordByAccount),
    schema: {
      summary: 'Demander un lien de réinitialisation de mot de passe par email',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['email'],
        properties: { email: { type: 'string', format: 'email' } },
      },
      response: {
        200: { type: 'object', properties: { sent: { type: 'boolean' } } },
        429: errorSchema,
      },
    },
  }, async (req, reply) => {
    const cleanEmail = req.body.email.toLowerCase().trim()

    const user = await fastify.prisma.user.findUnique({
      where:  { emailHash: hashEmail(cleanEmail) },
      select: { id: true },
    })

    if (user) {
      const token     = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS)

      await fastify.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hashToken(token), expiresAt },
      })

      const resetUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:5174'}/reset-password?token=${token}`
      try {
        await sendPasswordResetEmail(cleanEmail, resetUrl)
      } catch (err) {
        // Ne jamais faire dépendre la réponse d'un problème d'envoi (voir commentaire ci-dessus) :
        // seule la supervision serveur (logs) doit le voir.
        fastify.log.error(err, 'Échec de l\'envoi de l\'email de réinitialisation')
      }
    }

    return reply.code(200).send({ sent: true })
  })

  // ── POST /api/auth/reset-password ───────────────────────
  fastify.post<{ Body: { token: string; newPassword: string } }>('/api/auth/reset-password', {
    onRequest: enforce(resetPasswordByIp),
    schema: {
      summary: 'Choisir un nouveau mot de passe depuis un lien reçu par email',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['token', 'newPassword'],
        properties: {
          token:       { type: 'string' },
          newPassword: { type: 'string', minLength: 8, maxLength: 72 },
        },
      },
      response: {
        200: { type: 'object', properties: { csrfToken: { type: 'string' } } },
        400: errorSchema,
        429: errorSchema,
      },
    },
  }, async (req, reply) => {
    const invalidTokenResponse = () => reply.code(400).send({
      error: 'Ce lien de réinitialisation est invalide ou a expiré.',
      code:  'INVALID_TOKEN',
    })

    const resetToken = await fastify.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(req.body.token) },
    })

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return invalidTokenResponse()
    }

    const strength = evaluatePassword(req.body.newPassword)
    if (!strength.acceptable) {
      return reply.code(400).send({ error: weakPasswordMessage(strength), code: 'WEAK_PASSWORD' })
    }

    const user = await fastify.prisma.user.findUnique({
      where:  { id: resetToken.userId },
      select: { id: true, emailEncrypted: true },
    })
    if (!user) return invalidTokenResponse()

    const passwordHash = await bcrypt.hash(req.body.newPassword, BCRYPT_ROUNDS)

    const updated = await fastify.prisma.user.update({
      where:  { id: user.id },
      data:   { passwordHash, tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    })

    await fastify.prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data:  { usedAt: new Date() },
    })
    // Un lien plus ancien, encore valide, ne doit plus fonctionner une fois le mot de passe changé.
    await fastify.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, id: { not: resetToken.id } },
      data:  { usedAt: new Date() },
    })

    // Reconnecte directement sur cet appareil, comme après un changement de mot de passe classique
    // (voir PUT /api/user/password) : la personne vient de prouver qu'elle contrôle la boîte mail.
    const { csrfToken } = issueSession(fastify, reply, {
      id: user.id,
      email: decryptEmail(user.emailEncrypted),
      tokenVersion: updated.tokenVersion,
    })

    return reply.code(200).send({ csrfToken })
  })

  // ── POST /api/auth/logout ───────────────────────────────
  // Efface le cookie de session. N'exige pas d'être connecté (idempotent : appelable même sur une
  // session déjà expirée) et n'a pas besoin de vérification CSRF — le pire qu'une contrefaçon
  // obtiendrait est de déconnecter la victime, ce qu'un vrai logout fait tout autant.
  fastify.post('/api/auth/logout', {
    schema: {
      summary: 'Déconnexion — efface le cookie de session',
      tags: ['auth'],
      response: { 200: { type: 'object', properties: { loggedOut: { type: 'boolean' } } } },
    },
  }, async (_req, reply) => {
    clearSession(reply)
    return reply.code(200).send({ loggedOut: true })
  })
}

export { BCRYPT_ROUNDS }
