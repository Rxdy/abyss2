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
}
