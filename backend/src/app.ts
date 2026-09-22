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

import Fastify, { type FastifyError, type FastifyReply, type FastifyRequest } from 'fastify'
import type { PrismaClient } from '@prisma/client'
import type { } from './types.js' // pose le typage du jeton (FastifyJWT) pour toute l'application
import cors      from '@fastify/cors'
import cookie    from '@fastify/cookie'
import csrfProtection from '@fastify/csrf-protection'
import rateLimit from '@fastify/rate-limit'
import { rateLimitError } from './utils/rate-limit.js'
import helmet    from '@fastify/helmet'
import jwt       from '@fastify/jwt'
import swagger   from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { SESSION_COOKIE } from './utils/session.js'

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient
    /** Garde JWT : `preHandler: fastify.authenticate` (répond 401 si le jeton est absent, invalide ou révoqué). */
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<FastifyReply | void>
    /**
     * Vérification CSRF, mais seulement pour les requêtes authentifiées par cookie : un client qui
     * présente son propre `Authorization: Bearer` n'est pas exposé à la contrefaçon de requête
     * intersite (aucun navigateur n'attache ce jeton tout seul). À chaîner après `authenticate`
     * sur toute route qui modifie des données : `preHandler: [fastify.authenticate, fastify.csrfIfCookie]`.
     */
    csrfIfCookie: (req: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void) => void
  }
}

export async function buildApp(opts: { testing?: boolean; prisma?: PrismaClient } = {}) {
  const { testing = false, prisma: injectedPrisma } = opts

  // ── Instance Fastify ─────────────────────────────────────
  const fastify = Fastify({
    // Derrière un reverse proxy, `req.ip` serait celle du proxy : tous les clients partageraient
    // la même limite de débit. À activer (TRUST_PROXY=true) uniquement si le proxy est de confiance.
    trustProxy: process.env.TRUST_PROXY === 'true',
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
  // Pas de secret de repli hors tests : sans JWT_SECRET, n'importe qui pourrait
  // forger un jeton valide.
  if (!testing && !process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET env var is required')
  }

  // Pas de secret de signature (`register(cookie)` sans `secret`) : le cookie de session n'a pas
  // besoin d'être lui-même signé, le JWT qu'il transporte l'est déjà. Le cookie `_csrf` (posé par
  // csrfProtection ci-dessous) est lui aussi non signé par défaut, et n'a pas à l'être : son secret
  // ne quitte jamais le serveur, seul un jeton dérivé est envoyé au client.
  fastify.register(cookie)

  fastify.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'test-secret-do-not-use-in-production',
    sign: { expiresIn: '7d' },
    // En plus de l'en-tête Authorization (Bearer, toujours accepté — tests, outillage), un jeton
    // valide dans ce cookie httpOnly suffit : c'est ce que le front pose désormais (voir
    // utils/session.ts). `jwtVerify()` regarde l'en-tête d'abord, puis retombe sur le cookie.
    cookie: { cookieName: SESSION_COOKIE, signed: false },
  })

  fastify.register(csrfProtection)

  // L'API ne sert que du JSON : aucune ressource n'a à être chargée depuis ses réponses, ni à les
  // encadrer dans une page. (La documentation /docs, en développement, pose sa propre CSP — voir plus bas.)
  fastify.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc:     ["'none'"],
        frameAncestors: ["'none'"],
        baseUri:        ["'none'"],
        formAction:     ["'none'"],
      },
    },
  })

  fastify.register(cors, {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:5174',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    // Le cookie de session ne voyage que si le navigateur y est autorisé — nécessaire dès que
    // front et API n'ont pas exactement la même origine (en développement : ports différents).
    // Sans danger : `origin` ci-dessus est une valeur précise, jamais `*`, seule condition posée
    // par les navigateurs pour combiner credentials et CORS.
    credentials: true,
  })

  // Limitation de débit : `global: false`, chaque route sensible déclare la sienne
  // (voir routes/auth.ts). Stockage en mémoire, par instance d'API.
  await fastify.register(rateLimit, {
    global: false,
    // Coupe-circuit pour les environnements de test de charge ou de démo.
    allowList: () => process.env.RATE_LIMIT_DISABLED === 'true',
    errorResponseBuilder: (_req, context) => rateLimitError(context.ttl, context.statusCode),
  })

  // Garde JWT réutilisable : `preHandler: fastify.authenticate`
  //
  // Le `tv` du jeton (tokenVersion, voir POST /api/user/revoke-sessions et
  // PUT /api/user/password) est comparé à la version courante en base :
  // incrémenter tokenVersion invalide immédiatement tous les jetons déjà
  // émis. Un jeton sans `tv` est refusé — sinon il échapperait à la
  // révocation.
  fastify.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify()
    } catch {
      return reply.code(401).send({
        error: 'Token manquant ou invalide.',
        code:  'UNAUTHORIZED',
      })
    }

    const current = req.user?.tv === undefined
      ? null
      : await fastify.prisma.user.findUnique({
          where:  { id: req.user.userId },
          select: { tokenVersion: true },
        })

    if (!current || current.tokenVersion !== req.user.tv) {
      return reply.code(401).send({
        error: 'Session expirée — reconnectez-vous.',
        code:  'TOKEN_REVOKED',
      })
    }
  })

  // Voir la déclaration de type plus haut : un jeton Bearer explicite n'a rien à prouver de plus,
  // seule une session portée par le cookie ambiant passe par la vérification CSRF.
  fastify.decorate('csrfIfCookie', function (req: FastifyRequest, reply: FastifyReply, done: (err?: Error) => void) {
    if (req.headers.authorization) return done()
    fastify.csrfProtection(req, reply, done)
  })

  // La documentation interactive n'est exposée qu'en développement
  if (!testing && process.env.NODE_ENV !== 'production') {
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
      staticCSP: true, // CSP dédiée aux ressources de l'interface Swagger, sans toucher à celle de l'API
      // Swagger UI pose des styles inline : on l'autorise pour cette interface de développement seulement.
      transformStaticCSP: (header: string) => header.replace("style-src 'self' https:", "style-src 'self' https: 'unsafe-inline'"),
    })
  }

  // ── Prisma ───────────────────────────────────────────────
  const prismaInstance = injectedPrisma ?? (await import('./lib/prisma.js')).default
  fastify.decorate('prisma', prismaInstance)

  // ── Routes ───────────────────────────────────────────────
  fastify.register(import('./routes/auth.js'))
  fastify.register(import('./routes/user.js'))
  fastify.register(import('./routes/categories.js'))
  fastify.register(import('./routes/envelopes.js'))
  fastify.register(import('./routes/notifications.js'))
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
        503: {
          type: 'object',
          properties: {
            status:  { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, async (_req, reply) => {
    try {
      await prismaInstance.$queryRaw`SELECT 1`
      return { status: 'connected', schema: 'dbo' }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      return reply.code(503).send({ status: 'error', message })
    }
  })

  // ── Error handler ────────────────────────────────────────
  fastify.setErrorHandler((error: FastifyError, _req, reply) => {
    if (!testing) fastify.log.error(error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    const statusCode = error?.statusCode ?? 500
    reply.code(statusCode).send({
      // En production, seuls les messages d'erreur client (4xx) sont exposés ; les 5xx restent génériques.
      error: process.env.NODE_ENV === 'production' && statusCode >= 500
        ? 'Internal server error'
        : message,
      code: error?.code ?? 'INTERNAL_ERROR',
    })
  })

  return fastify
}
