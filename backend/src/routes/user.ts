import bcrypt from 'bcryptjs'
import { decryptEmail } from '../utils/crypto.js'
import { BCRYPT_ROUNDS } from './auth.js'

const errorSchema = {
  type: 'object',
  properties: { error: { type: 'string' }, code: { type: 'string' } },
}

/** Signe un nouveau JWT pour l'utilisateur — utilisé après tout ce qui invalide les jetons existants. */
function issueToken(fastify: any, user: { id: string; email: string; tokenVersion: number }) {
  return fastify.jwt.sign(
    { userId: user.id, email: user.email, tv: user.tokenVersion },
    { expiresIn: '7d' },
  )
}

export default async function userRoutes(fastify: any) {
  // ── GET /api/user ───────────────────────────────────────
  // Sert aussi à valider le JWT au démarrage du front.
  fastify.get('/api/user', {
    schema: {
      summary: "Profil de l'utilisateur connecté",
      tags: ['user'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            id:        { type: 'string', format: 'uuid' },
            email:     { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' }, code: { type: 'string' } },
        },
      },
    },
    preHandler: fastify.authenticate,
  }, async (req: any, reply: any) => {
    const user = await fastify.prisma.user.findUnique({
      where:  { id: req.user.userId },
      select: { id: true, emailEncrypted: true, createdAt: true },
    })

    if (!user) {
      return reply.code(401).send({
        error: 'Utilisateur introuvable.',
        code:  'USER_NOT_FOUND',
      })
    }

    return reply.code(200).send({
      id:        user.id,
      email:     decryptEmail(user.emailEncrypted),
      createdAt: user.createdAt,
    })
  })

  // ── DELETE /api/user ─────────────────────────────────────
  // Suppression définitive du compte (droit à l'effacement RGPD) : le mot
  // de passe est redemandé pour confirmer. La suppression de la ligne User
  // entraîne, par contrainte ON DELETE CASCADE, celle de toutes ses
  // catégories, transactions et charges fixes — aucune trace ne subsiste.
  fastify.delete('/api/user', {
    schema: {
      summary: 'Supprimer définitivement le compte et toutes ses données',
      tags: ['user'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['password'],
        properties: { password: { type: 'string' } },
      },
      response: {
        200: { type: 'object', properties: { deleted: { type: 'boolean' } } },
        401: { type: 'object', properties: { error: { type: 'string' }, code: { type: 'string' } } },
      },
    },
    preHandler: fastify.authenticate,
  }, async (req: any, reply: any) => {
    const user = await fastify.prisma.user.findUnique({
      where:  { id: req.user.userId },
      select: { id: true, passwordHash: true },
    })

    if (!user) {
      return reply.code(401).send({ error: 'Utilisateur introuvable.', code: 'USER_NOT_FOUND' })
    }

    const isValid = await bcrypt.compare(req.body.password, user.passwordHash)
    if (!isValid) {
      return reply.code(401).send({ error: 'Mot de passe incorrect.', code: 'INVALID_CREDENTIALS' })
    }

    await fastify.prisma.user.delete({ where: { id: user.id } })

    return reply.code(200).send({ deleted: true })
  })

  // ── PUT /api/user/password ──────────────────────────────
  // Change le mot de passe et invalide toutes les autres sessions (jeton
  // ré-émis pour l'appareil courant, qui reste donc connecté).
  fastify.put('/api/user/password', {
    schema: {
      summary: 'Changer le mot de passe (déconnecte les autres appareils)',
      tags: ['user'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword:     { type: 'string', minLength: 8 },
        },
      },
      response: {
        200: { type: 'object', properties: { token: { type: 'string' } } },
        400: errorSchema,
        401: errorSchema,
      },
    },
    preHandler: fastify.authenticate,
  }, async (req: any, reply: any) => {
    const user = await fastify.prisma.user.findUnique({
      where:  { id: req.user.userId },
      select: { id: true, emailEncrypted: true, passwordHash: true },
    })

    if (!user) {
      return reply.code(401).send({ error: 'Utilisateur introuvable.', code: 'USER_NOT_FOUND' })
    }

    const isValid = await bcrypt.compare(req.body.currentPassword, user.passwordHash)
    if (!isValid) {
      return reply.code(401).send({ error: 'Mot de passe actuel incorrect.', code: 'INVALID_CREDENTIALS' })
    }

    if (req.body.newPassword === req.body.currentPassword) {
      return reply.code(400).send({
        error: 'Le nouveau mot de passe doit être différent de l\'actuel.',
        code:  'SAME_PASSWORD',
      })
    }

    const passwordHash = await bcrypt.hash(req.body.newPassword, BCRYPT_ROUNDS)

    const updated = await fastify.prisma.user.update({
      where: { id: user.id },
      data:  { passwordHash, tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    })

    const token = issueToken(fastify, {
      id: user.id,
      email: decryptEmail(user.emailEncrypted),
      tokenVersion: updated.tokenVersion,
    })

    return reply.code(200).send({ token })
  })

  // ── POST /api/user/revoke-sessions ──────────────────────
  // Déconnecte tous les autres appareils : incrémente tokenVersion (tous
  // les jetons déjà émis deviennent invalides) et ré-émet un jeton pour
  // l'appareil courant, qui reste donc connecté.
  fastify.post('/api/user/revoke-sessions', {
    schema: {
      summary: 'Déconnecter tous les autres appareils',
      tags: ['user'],
      security: [{ bearerAuth: [] }],
      response: {
        200: { type: 'object', properties: { token: { type: 'string' } } },
        401: errorSchema,
      },
    },
    preHandler: fastify.authenticate,
  }, async (req: any, reply: any) => {
    const user = await fastify.prisma.user.findUnique({
      where:  { id: req.user.userId },
      select: { id: true, emailEncrypted: true },
    })

    if (!user) {
      return reply.code(401).send({ error: 'Utilisateur introuvable.', code: 'USER_NOT_FOUND' })
    }

    const updated = await fastify.prisma.user.update({
      where: { id: user.id },
      data:  { tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    })

    const token = issueToken(fastify, {
      id: user.id,
      email: decryptEmail(user.emailEncrypted),
      tokenVersion: updated.tokenVersion,
    })

    return reply.code(200).send({ token })
  })
}
