/**
 * Routes /api/notifications
 *
 * Deux types générés côté serveur (voir utils/notifications.ts) : enveloppe dépassée, dépenses non
 * catégorisées. Le titre et le message ne sont jamais stockés : reconstruits à la lecture à partir
 * de `type` (+ `envelopeId`/`count`) — rien de texte libre à chiffrer ici, contrairement aux autres
 * ressources de l'app.
 */

import type { FastifyInstance } from 'fastify'
import { decryptValue } from '../utils/crypto.js'
import { maybeCreateUncategorizedDigest } from '../utils/notifications.js'
import { ENVELOPE_NAME_USAGE } from './envelopes.js'
import type { ApiError } from '../types.js'

const errorSchema = {
  type: 'object',
  properties: { error: { type: 'string' }, code: { type: 'string' } },
}

const notificationSchema = {
  type: 'object',
  properties: {
    id:         { type: 'string', format: 'uuid' },
    type:       { type: 'string' },
    title:      { type: 'string' },
    message:    { type: 'string' },
    envelopeId: { type: 'string', format: 'uuid', nullable: true },
    count:      { type: 'integer', nullable: true },
    read:       { type: 'boolean' },
    archived:   { type: 'boolean' },
    createdAt:  { type: 'string', format: 'date-time' },
  },
}

interface NotificationRow {
  id: string
  type: string
  envelopeId: string | null
  count: number | null
  read: boolean
  archived: boolean
  createdAt: Date
  envelope: { nameEncrypted: string } | null
}

/** Titre + message reconstruits à partir du type — voir le commentaire d'en-tête. */
function toApi(row: NotificationRow) {
  const envelopeName = row.envelope ? decryptValue(row.envelope.nameEncrypted, ENVELOPE_NAME_USAGE) : null

  const { title, message } = row.type === 'envelope_overspend'
    ? {
        title:   'Enveloppe dépassée',
        message: envelopeName
          ? `L'enveloppe « ${envelopeName} » a dépassé son plafond mensuel.`
          : 'Une enveloppe a dépassé son plafond mensuel.',
      }
    : {
        title:   'Dépenses non catégorisées',
        message: (row.count ?? 0) > 1
          ? `${row.count} dépenses ne sont rattachées à aucune catégorie.`
          : `${row.count} dépense n'est rattachée à aucune catégorie.`,
      }

  return {
    id:         row.id,
    type:       row.type,
    title,
    message,
    envelopeId: row.envelopeId,
    count:      row.count,
    read:       row.read,
    archived:   row.archived,
    createdAt:  row.createdAt,
  }
}

export default async function notificationRoutes(fastify: FastifyInstance) {
  // ── GET /api/notifications ───────────────────────────────
  fastify.get<{ Querystring: { archived?: string } }>('/api/notifications', {
    schema: {
      summary: 'Lister les notifications',
      tags: ['notifications'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: { archived: { type: 'string', enum: ['true', 'false'], default: 'false' } },
      },
      response: { 200: { type: 'array', items: notificationSchema }, 401: errorSchema },
    },
    preHandler: fastify.authenticate,
  }, async (req) => {
    await maybeCreateUncategorizedDigest(fastify.prisma, req.user.userId)

    const rows = await fastify.prisma.notification.findMany({
      where:   { userId: req.user.userId, archived: req.query.archived === 'true' },
      orderBy: { createdAt: 'desc' },
      include: { envelope: { select: { nameEncrypted: true } } },
    })

    return rows.map(toApi)
  })

  // ── GET /api/notifications/unread-count ──────────────────
  fastify.get('/api/notifications/unread-count', {
    schema: {
      summary: 'Nombre de notifications non lues (pour le badge)',
      tags: ['notifications'],
      security: [{ bearerAuth: [] }],
      response: { 200: { type: 'object', properties: { count: { type: 'integer' } } }, 401: errorSchema },
    },
    preHandler: fastify.authenticate,
  }, async (req) => {
    await maybeCreateUncategorizedDigest(fastify.prisma, req.user.userId)

    const count = await fastify.prisma.notification.count({
      where: { userId: req.user.userId, read: false, archived: false },
    })

    return { count }
  })

  // ── PUT /api/notifications/:id ────────────────────────────
  fastify.put<{ Params: { id: string }; Body: { read?: boolean; archived?: boolean } }>('/api/notifications/:id', {
    schema: {
      summary: 'Marquer une notification lue et/ou l\'archiver',
      tags: ['notifications'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        properties: { read: { type: 'boolean' }, archived: { type: 'boolean' } },
      },
      response: { 200: notificationSchema, 401: errorSchema, 404: errorSchema },
    },
    preHandler: [fastify.authenticate, fastify.csrfIfCookie],
  }, async (req, reply) => {
    const existing = await fastify.prisma.notification.findFirst({
      where:  { id: req.params.id, userId: req.user.userId },
      select: { id: true },
    })

    if (!existing) {
      const error: ApiError = { error: 'Notification introuvable.', code: 'NOTIFICATION_NOT_FOUND' }
      return reply.code(404).send(error)
    }

    const { read, archived } = req.body

    const updated = await fastify.prisma.notification.update({
      where: { id: req.params.id },
      data: {
        ...(read     !== undefined && { read }),
        ...(archived !== undefined && { archived }),
      },
      include: { envelope: { select: { nameEncrypted: true } } },
    })

    return reply.code(200).send(toApi(updated))
  })

  // ── DELETE /api/notifications/:id ─────────────────────────
  fastify.delete<{ Params: { id: string } }>('/api/notifications/:id', {
    schema: {
      summary: 'Supprimer une notification',
      tags: ['notifications'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      response: {
        200: { type: 'object', properties: { id: { type: 'string' }, deleted: { type: 'boolean' } } },
        401: errorSchema,
        404: errorSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.csrfIfCookie],
  }, async (req, reply) => {
    const existing = await fastify.prisma.notification.findFirst({
      where:  { id: req.params.id, userId: req.user.userId },
      select: { id: true },
    })

    if (!existing) {
      const error: ApiError = { error: 'Notification introuvable.', code: 'NOTIFICATION_NOT_FOUND' }
      return reply.code(404).send(error)
    }

    await fastify.prisma.notification.delete({ where: { id: req.params.id } })

    return reply.code(200).send({ id: req.params.id, deleted: true })
  })
}
