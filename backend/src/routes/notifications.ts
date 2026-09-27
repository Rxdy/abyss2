/**
 * Routes /api/notifications
 *
 * Trois types générés côté serveur (voir utils/notifications.ts) : enveloppe dépassée, solde
 * négatif, dépenses non catégorisées. Le titre et le message ne sont jamais stockés : reconstruits
 * à la lecture à partir de `type` (+ `envelopeId`) et de chiffres relus au même moment (voir
 * loadLiveFigures) — rien de texte libre à chiffrer ici, contrairement aux autres ressources de
 * l'app.
 */

import type { FastifyInstance } from 'fastify'
import { decryptValue } from '../utils/crypto.js'
import { maybeCreateUncategorizedDigest } from '../utils/notifications.js'
import { ENVELOPE_NAME_USAGE, ENVELOPE_BUDGET_USAGE } from './envelopes.js'
import { AMOUNT_USAGE } from './transactions.js'
import type { ApiError } from '../types.js'
import { formatCents } from '../utils/currency.js'

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
  envelope: { nameEncrypted: string; budgetEncrypted: string; categories: { id: string }[] } | null
}

/** Ce qu'il faut relire pour chaque ligne : l'enveloppe, son plafond et ses catégories. */
const ROW_INCLUDE = {
  envelope: { select: { nameEncrypted: true, budgetEncrypted: true, categories: { select: { id: true } } } },
} as const

const monthLabel = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** Bornes UTC du mois d'une date (celui où le dépassement a eu lieu). */
function monthOf(date: Date) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  const end   = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
  return { start, end, key: start.toISOString().slice(0, 7) }
}

/**
 * Chiffres « vivants » des notifications, relus à chaque lecture plutôt que figés à la création :
 * le nombre actuel de dépenses non catégorisées (le digest ne reste pas bloqué sur un chiffre
 * périmé une fois les dépenses catégorisées), et, pour chaque dépassement, ce qui a été dépensé
 * dans l'enveloppe au cours du mois concerné. Rien de tout ça n'est stocké : les montants restent
 * chiffrés en base, seules ces lectures les déchiffrent.
 */
interface LiveFigures {
  currency: string
  uncategorized: number
  spent: Map<string, number> // clé `${envelopeId}|${yyyy-mm}`
}

async function loadLiveFigures(fastify: FastifyInstance, userId: string, rows: NotificationRow[]): Promise<LiveFigures> {
  const user = await fastify.prisma.user.findUnique({ where: { id: userId }, select: { currency: true } })
  const figures: LiveFigures = { currency: user?.currency ?? 'EUR', uncategorized: 0, spent: new Map() }

  if (rows.some((row) => row.type === 'uncategorized_digest')) {
    figures.uncategorized = await fastify.prisma.transaction.count({
      where: { userId, type: 'expense', categoryId: null },
    })
  }

  for (const row of rows) {
    if (row.type !== 'envelope_overspend' || !row.envelope || !row.envelopeId) continue
    const { start, end, key } = monthOf(row.createdAt)
    const spentKey = `${row.envelopeId}|${key}`
    if (figures.spent.has(spentKey)) continue

    const expenses = await fastify.prisma.transaction.findMany({
      where: {
        userId,
        type:       'expense',
        categoryId: { in: row.envelope.categories.map((c) => c.id) },
        date:       { gte: start, lte: end },
      },
      select: { amountEncrypted: true },
    })
    figures.spent.set(spentKey, expenses.reduce((sum, t) => sum + parseInt(decryptValue(t.amountEncrypted, AMOUNT_USAGE), 10), 0))
  }

  return figures
}

/** Titre + message reconstruits à partir du type — voir le commentaire d'en-tête. */
function describe(row: NotificationRow, figures: LiveFigures) {
  switch (row.type) {
    case 'envelope_overspend': {
      if (!row.envelope || !row.envelopeId) {
        return { title: 'Enveloppe dépassée', message: 'Une enveloppe a dépassé son plafond mensuel.' }
      }
      const name   = decryptValue(row.envelope.nameEncrypted, ENVELOPE_NAME_USAGE)
      const budget = parseInt(decryptValue(row.envelope.budgetEncrypted, ENVELOPE_BUDGET_USAGE), 10)
      const { key } = monthOf(row.createdAt)
      const spent  = figures.spent.get(`${row.envelopeId}|${key}`) ?? 0
      const month  = monthLabel.format(row.createdAt)
      const money  = (cents: number) => formatCents(cents, figures.currency)

      return {
        title:   'Enveloppe dépassée',
        message: spent > budget
          ? `« ${name} » : ${money(spent)} dépensés en ${month}, pour un plafond de ${money(budget)}.`
          // Dépenses supprimées ou plafond relevé depuis : on le dit plutôt que d'afficher un « dépassé » contredit par les chiffres.
          : `« ${name} » a dépassé son plafond en ${month}, mais est depuis revenue à ${money(spent)} sur ${money(budget)}.`,
      }
    }
    case 'negative_balance':
      return {
        title:   'Solde négatif',
        message: 'Votre solde est passé sous zéro.',
      }
    default: {
      const count = figures.uncategorized
      return {
        title:   'Dépenses non catégorisées',
        message: count === 0
          ? 'Toutes vos dépenses sont désormais rattachées à une catégorie.'
          : count > 1
            ? `${count} dépenses ne sont rattachées à aucune catégorie.`
            : '1 dépense n\'est rattachée à aucune catégorie.',
      }
    }
  }
}

function toApi(row: NotificationRow, figures: LiveFigures) {
  const { title, message } = describe(row, figures)

  return {
    id:         row.id,
    type:       row.type,
    title,
    message,
    envelopeId: row.envelopeId,
    count:      row.type === 'uncategorized_digest' ? figures.uncategorized : row.count,
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
      include: ROW_INCLUDE,
    })

    const figures = await loadLiveFigures(fastify, req.user.userId, rows)
    return rows.map((row) => toApi(row, figures))
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

  // ── POST /api/notifications/read-all ─────────────────────
  fastify.post('/api/notifications/read-all', {
    schema: {
      summary: 'Marquer toutes les notifications actives comme lues',
      tags: ['notifications'],
      security: [{ bearerAuth: [] }],
      response: {
        200: { type: 'object', properties: { updated: { type: 'integer', description: 'Nombre de notifications passées en lues' } } },
        401: errorSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.csrfIfCookie],
  }, async (req) => {
    // Les archivées ne comptent pas dans le badge : on ne touche qu'à ce que l'utilisateur voit.
    const { count } = await fastify.prisma.notification.updateMany({
      where: { userId: req.user.userId, read: false, archived: false },
      data:  { read: true },
    })

    return { updated: count }
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
      include: ROW_INCLUDE,
    })

    return reply.code(200).send(toApi(updated, await loadLiveFigures(fastify, req.user.userId, [updated])))
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
