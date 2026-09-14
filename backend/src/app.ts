/**
 * app.ts — Factory Fastify pour Abyss2 API
 *
 * Exporte buildApp(opts) utilisé à la fois par server.ts (production)
 * et par les tests (avec Prisma mocké, logger désactivé).
 *
 * Usage production :
 *   const app = await buildApp()
 *
 * Usage test :
 *   const app = await buildApp({ testing: true, prisma: mockPrisma })
 */

import Fastify   from 'fastify'
import cors      from '@fastify/cors'
import helmet    from '@fastify/helmet'
import jwt       from '@fastify/jwt'
import swagger   from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'

export async function buildApp(opts: { testing?: boolean; prisma?: any } = {}) {
  const { testing = false, prisma: injectedPrisma } = opts

  // ── Instance Fastify ─────────────────────────────────────
  const fastify = Fastify({
    logger: testing
      ? false
      : {
          level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
          transport: process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty' }
            : undefined,
        },
  })

  // ── Plugins ──────────────────────────────────────────────
  fastify.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'test-secret-do-not-use-in-production',
    sign: { expiresIn: '7d' },
  })

  fastify.register(helmet, { contentSecurityPolicy: false })

  fastify.register(cors, {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5174',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  })

  // Garde JWT réutilisable : `preHandler: fastify.authenticate`
  fastify.decorate('authenticate', async (req: any, reply: any) => {
    try {
      await req.jwtVerify()
    } catch {
      return reply.code(401).send({
        error: 'Token manquant ou invalide.',
        code:  'UNAUTHORIZED',
      })
    }
  })

  if (!testing) {
    fastify.register(swagger, {
      openapi: {
        info: {
          title: 'Abyss2 API',
          description: "Documentation complète de l'API Abyss2.",
          version: '1.0.0',
        },
        servers: [{ url: 'http://localhost:3002', description: 'Local' }],
        components: {
          securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
          },
        },
        tags: [
          { name: 'infra',        description: 'Health, statut et monitoring' },
          { name: 'auth',         description: 'Inscription et authentification' },
          { name: 'user',         description: 'Profil utilisateur' },
          { name: 'categories',   description: 'Catégories de dépenses' },
          { name: 'transactions', description: 'Transactions et récapitulatif' },
          { name: 'recurring',    description: 'Dépenses et revenus fixes mensuels' },
          { name: 'stats',        description: 'Statistiques et répartition par catégorie' },
        ],
      },
    })

    fastify.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
        displayRequestDuration: true,
      },
      staticCSP: false,
    })
  }

  // ── Prisma ───────────────────────────────────────────────
  const prismaInstance = injectedPrisma ?? (await import('./lib/prisma.js')).default
  fastify.decorate('prisma', prismaInstance)

  // ── Routes ───────────────────────────────────────────────
  fastify.register(import('./routes/auth.js'))
  fastify.register(import('./routes/user.js'))
  fastify.register(import('./routes/categories.js'))
  fastify.register(import('./routes/transactions.js'))
  fastify.register(import('./routes/recurring.js'))
  fastify.register(import('./routes/stats.js'))

  fastify.get('/health', {
    schema: {
      summary: 'Health check',
      tags: ['infra'],
      response: {
        200: {
          type: 'object',
          properties: {
            status:    { type: 'string' },
            service:   { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
  }, async () => ({
    status: 'ok',
    service: 'api',
    timestamp: new Date().toISOString(),
  }))

  fastify.get('/api/db-status', {
    schema: {
      summary: 'Statut de la base de données PostgreSQL',
      tags: ['infra'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            schema: { type: 'string' },
          },
        },
      },
    },
  }, async (req: any, reply: any) => {
    try {
      await prismaInstance.$queryRaw`SELECT 1`
      return { status: 'connected', schema: 'dbo' }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return reply.code(503).send({ status: 'error', message })
    }
  })

  // ── Error handler ────────────────────────────────────────
  fastify.setErrorHandler((error: any, req, reply) => {
    if (!testing) fastify.log.error(error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    reply.code(error?.statusCode ?? 500).send({
      error: process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : message,
      code: error?.code ?? 'INTERNAL_ERROR',
    })
  })

  return fastify
}
