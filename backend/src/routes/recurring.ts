/**
 * Routes /api/recurring — dépenses et revenus fixes mensuels
 *
 * Un modèle récurrent ne stocke pas de transactions du mois : il sert de
 * gabarit, et `runDueRecurring` (voir utils/recurring.ts) génère les
 * transactions réelles au fil du temps. On l'appelle ici aussi (après
 * création/modification) pour que le premier mois dû n'attende pas un
 * aller-retour sur /api/transactions.
 *
 * Modifier ou supprimer un modèle ne touche jamais aux transactions déjà
 * générées (recurring_id → NULL en cas de suppression, comme pour les
 * catégories) : l'historique reste intact.
 */

import { encryptValue, decryptValue } from '../utils/crypto.js'
import { CATEGORY_USAGE } from './categories.js'
import { TITLE_USAGE, AMOUNT_USAGE, assertCategoryOwned } from './transactions.js'
import { runDueRecurring, nextOccurrenceDate } from '../utils/recurring.js'

const TYPES = ['expense', 'income']

const recurringSchema = {
  type: 'object',
  properties: {
    id:         { type: 'string', format: 'uuid' },
    title:      { type: 'string' },
    amount:     { type: 'integer', description: 'Montant en centimes, toujours positif' },
    type:       { type: 'string', enum: TYPES },
    dayOfMonth: { type: 'integer', minimum: 1, maximum: 31 },
    note:       { type: 'string', nullable: true },
    active:     { type: 'boolean' },
    startDate:  { type: 'string' },
    endDate:    { type: 'string', nullable: true },
    nextDate:   { type: 'string', nullable: true, description: 'Prochaine échéance à venir, null si terminée' },
    category: {
      type: 'object',
      nullable: true,
      properties: {
        id:    { type: 'string' },
        name:  { type: 'string' },
        color: { type: 'string', nullable: true },
      },
    },
  },
}

const errorSchema = {
  type: 'object',
  properties: { error: { type: 'string' }, code: { type: 'string' } },
}

/** yyyy-mm-dd, sans dépendre du fuseau local. */
function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

/** Ligne Prisma (+ catégorie jointe) → objet exposé par l'API. */
function toApi(recurring: any) {
  const next = recurring.active ? nextOccurrenceDate(recurring) : null

  return {
    id:         recurring.id,
    title:      decryptValue(recurring.titleEncrypted, TITLE_USAGE),
    amount:     parseInt(decryptValue(recurring.amountEncrypted, AMOUNT_USAGE), 10),
    type:       recurring.type,
    dayOfMonth: recurring.dayOfMonth,
    note:       recurring.note,
    active:     recurring.active,
    startDate:  formatDate(recurring.startDate),
    endDate:    recurring.endDate ? formatDate(recurring.endDate) : null,
    nextDate:   next ? formatDate(next) : null,
    category: recurring.category
      ? {
          id:    recurring.category.id,
          name:  decryptValue(recurring.category.nameEncrypted, CATEGORY_USAGE),
          color: recurring.category.color,
        }
      : null,
  }
}

export default async function recurringRoutes(fastify: any) {
  // ── GET /api/recurring ──────────────────────────────────
  fastify.get('/api/recurring', {
    schema: {
      summary: 'Lister les dépenses/revenus fixes de l\'utilisateur',
      tags: ['recurring'],
      security: [{ bearerAuth: [] }],
      response: { 200: { type: 'array', items: recurringSchema }, 401: errorSchema },
    },
    preHandler: fastify.authenticate,
  }, async (req: any) => {
    await runDueRecurring(fastify.prisma, req.user.userId)

    const recurring = await fastify.prisma.recurringTransaction.findMany({
      where:   { userId: req.user.userId },
      include: { category: true },
      orderBy: [{ active: 'desc' }, { dayOfMonth: 'asc' }, { createdAt: 'asc' }],
    })

    return recurring.map(toApi)
  })

  // ── POST /api/recurring ─────────────────────────────────
  fastify.post('/api/recurring', {
    schema: {
      summary: 'Créer une dépense ou un revenu fixe mensuel',
      tags: ['recurring'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['title', 'amount', 'dayOfMonth'],
        properties: {
          title:      { type: 'string', minLength: 1, maxLength: 120 },
          amount:     { type: 'integer', minimum: 1, description: 'Centimes, positif' },
          type:       { type: 'string', enum: TYPES, default: 'expense' },
          dayOfMonth: { type: 'integer', minimum: 1, maximum: 31 },
          categoryId: { type: 'string', format: 'uuid', nullable: true },
          note:       { type: 'string', maxLength: 500, nullable: true },
          active:     { type: 'boolean', default: true },
          startDate:  { type: 'string', format: 'date' },
          endDate:    { type: 'string', format: 'date', nullable: true },
        },
      },
      response: { 201: recurringSchema, 400: errorSchema, 401: errorSchema },
    },
    preHandler: fastify.authenticate,
  }, async (req: any, reply: any) => {
    const {
      title, amount, type = 'expense', dayOfMonth, categoryId = null, note = null,
      active = true, startDate, endDate = null,
    } = req.body

    if (!(await assertCategoryOwned(fastify, req.user.userId, categoryId))) {
      return reply.code(400).send({ error: 'Catégorie introuvable.', code: 'CATEGORY_NOT_FOUND' })
    }

    const start = startDate ? new Date(startDate) : new Date(new Date().toISOString().slice(0, 10))

    if (endDate && new Date(endDate) < start) {
      return reply.code(400).send({ error: 'La date de fin doit être après la date de début.', code: 'END_BEFORE_START' })
    }

    const recurring = await fastify.prisma.recurringTransaction.create({
      data: {
        userId:          req.user.userId,
        categoryId,
        titleEncrypted:  encryptValue(title.trim(), TITLE_USAGE),
        amountEncrypted: encryptValue(String(amount), AMOUNT_USAGE),
        type,
        dayOfMonth,
        note,
        active,
        startDate: start,
        endDate:   endDate ? new Date(endDate) : null,
      },
      include: { category: true },
    })

    await runDueRecurring(fastify.prisma, req.user.userId)

    const fresh = await fastify.prisma.recurringTransaction.findFirst({
      where:   { id: recurring.id },
      include: { category: true },
    })

    return reply.code(201).send(toApi(fresh ?? recurring))
  })

  // ── PUT /api/recurring/:id ──────────────────────────────
  fastify.put('/api/recurring/:id', {
    schema: {
      summary: 'Modifier une dépense/un revenu fixe (pause via active:false)',
      tags: ['recurring'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        properties: {
          title:      { type: 'string', minLength: 1, maxLength: 120 },
          amount:     { type: 'integer', minimum: 1 },
          type:       { type: 'string', enum: TYPES },
          dayOfMonth: { type: 'integer', minimum: 1, maximum: 31 },
          categoryId: { type: 'string', format: 'uuid', nullable: true },
          note:       { type: 'string', maxLength: 500, nullable: true },
          active:     { type: 'boolean' },
          startDate:  { type: 'string', format: 'date' },
          endDate:    { type: 'string', format: 'date', nullable: true },
        },
      },
      response: { 200: recurringSchema, 400: errorSchema, 401: errorSchema, 404: errorSchema },
    },
    preHandler: fastify.authenticate,
  }, async (req: any, reply: any) => {
    const existing = await fastify.prisma.recurringTransaction.findFirst({
      where: { id: req.params.id, userId: req.user.userId },
    })

    if (!existing) {
      return reply.code(404).send({ error: 'Dépense/revenu fixe introuvable.', code: 'RECURRING_NOT_FOUND' })
    }

    const { title, amount, type, dayOfMonth, categoryId, note, active, startDate, endDate } = req.body

    if (categoryId !== undefined && !(await assertCategoryOwned(fastify, req.user.userId, categoryId))) {
      return reply.code(400).send({ error: 'Catégorie introuvable.', code: 'CATEGORY_NOT_FOUND' })
    }

    const nextStart = startDate !== undefined ? new Date(startDate) : existing.startDate
    const nextEnd   = endDate   !== undefined ? (endDate ? new Date(endDate) : null) : existing.endDate

    if (nextEnd && nextEnd < nextStart) {
      return reply.code(400).send({ error: 'La date de fin doit être après la date de début.', code: 'END_BEFORE_START' })
    }

    const recurring = await fastify.prisma.recurringTransaction.update({
      where: { id: req.params.id },
      data: {
        ...(title      !== undefined && { titleEncrypted:  encryptValue(title.trim(), TITLE_USAGE) }),
        ...(amount     !== undefined && { amountEncrypted: encryptValue(String(amount), AMOUNT_USAGE) }),
        ...(type       !== undefined && { type }),
        ...(dayOfMonth !== undefined && { dayOfMonth }),
        ...(categoryId !== undefined && { categoryId }),
        ...(note       !== undefined && { note }),
        ...(active     !== undefined && { active }),
        ...(startDate  !== undefined && { startDate: nextStart }),
        ...(endDate    !== undefined && { endDate: nextEnd }),
      },
      include: { category: true },
    })

    await runDueRecurring(fastify.prisma, req.user.userId)

    const fresh = await fastify.prisma.recurringTransaction.findFirst({
      where:   { id: recurring.id },
      include: { category: true },
    })

    return reply.code(200).send(toApi(fresh ?? recurring))
  })

  // ── DELETE /api/recurring/:id ───────────────────────────
  fastify.delete('/api/recurring/:id', {
    schema: {
      summary: 'Supprimer une dépense/un revenu fixe (les transactions déjà générées sont conservées)',
      tags: ['recurring'],
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
    preHandler: fastify.authenticate,
  }, async (req: any, reply: any) => {
    const existing = await fastify.prisma.recurringTransaction.findFirst({
      where:  { id: req.params.id, userId: req.user.userId },
      select: { id: true },
    })

    if (!existing) {
      return reply.code(404).send({ error: 'Dépense/revenu fixe introuvable.', code: 'RECURRING_NOT_FOUND' })
    }

    await fastify.prisma.recurringTransaction.delete({ where: { id: req.params.id } })

    return reply.code(200).send({ id: req.params.id, deleted: true })
  })
}
