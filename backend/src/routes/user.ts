import bcrypt from 'bcryptjs'
import { decryptEmail } from '../utils/crypto.js'

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
}
