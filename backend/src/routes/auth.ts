import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { hashEmail, encryptEmail, decryptEmail, encryptValue } from '../utils/crypto.js'
import { CATEGORY_USAGE } from './categories.js'

const BCRYPT_ROUNDS = 12

/** Catégories créées avec le compte — modifiables ensuite depuis le profil. */
const DEFAULT_CATEGORIES = [
  { name: 'Alimentation', color: '#4ade80' },
  { name: 'Transport',    color: '#4f8ef7' },
  { name: 'Logement',     color: '#a78bfa' },
  { name: 'Santé',        color: '#f87171' },
  { name: 'Loisirs',      color: '#facc15' },
  { name: 'Abonnements',  color: '#38bdf8' },
  { name: 'Épargne',      color: '#2dd4bf' },
  { name: 'Divers',       color: '#94a3b8' },
]

/**
 * Génère un sel aléatoire (16 bytes = 32 chars hex)
 */
function generateSalt() {
  return crypto.randomBytes(16).toString('hex')
}

/**
 * Génère un keyFragment hex unique par utilisateur (32 bytes = 64 chars hex)
 * Composante côté serveur pour la dérivation de clé (phase 2)
 */
function generateKeyFragment() {
  return crypto.randomBytes(32).toString('hex')
}

export default async function authRoutes(fastify: any) {
  // ── POST /api/auth/register ─────────────────────────────
  fastify.post('/api/auth/register', {
    schema: {
      summary: 'Créer un compte utilisateur',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email:    { type: 'string', format: 'email', description: 'Adresse email' },
          password: { type: 'string', minLength: 8, description: 'Mot de passe (min 8 chars)' },
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
        409: {
          type: 'object',
          properties: { error: { type: 'string' }, code: { type: 'string' } },
        },
      },
    },
  }, async (req: any, reply: any) => {
    const { email, password } = req.body
    const cleanEmail = email.toLowerCase().trim()

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

    // Sels pour dérivation de clé (phase 2 : Argon2id + HKDF)
    const authSalt    = generateSalt()
    const keySalt     = generateSalt()
    const keyFragment = generateKeyFragment()

    const user = await fastify.prisma.user.create({
      data:   { emailHash, emailEncrypted, passwordHash, authSalt, keySalt, keyFragment },
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
  fastify.post('/api/auth/login', {
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
            token: { type: 'string' },
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
      },
    },
  }, async (req: any, reply: any) => {
    const { email, password } = req.body
    const cleanEmail = email.toLowerCase().trim()

    // Lookup via blind index uniquement
    const user = await fastify.prisma.user.findUnique({
      where:  { emailHash: hashEmail(cleanEmail) },
      select: {
        id:             true,
        emailEncrypted: true,
        passwordHash:   true,
      },
    })

    if (!user) {
      return reply.code(401).send({
        error: 'Email ou mot de passe incorrect.',
        code:  'INVALID_CREDENTIALS',
      })
    }

    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) {
      return reply.code(401).send({
        error: 'Email ou mot de passe incorrect.',
        code:  'INVALID_CREDENTIALS',
      })
    }

    // Déchiffrer l'email pour le JWT et la réponse
    const decryptedEmail = decryptEmail(user.emailEncrypted)

    const token = fastify.jwt.sign(
      { userId: user.id, email: decryptedEmail },
      { expiresIn: '7d' }
    )

    return reply.code(200).send({
      token,
      user: { id: user.id, email: decryptedEmail },
    })
  })
}
