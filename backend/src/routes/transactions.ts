/**
 * Routes /api/transactions et /api/summary
 *
 * Libellé et montant sont chiffrés en base (AES-256-GCM). Le montant est stocké
 * en **centimes** : un entier, sérialisé puis chiffré — pas de flottant, pas de
 * montant lisible en base.
 *
 * Conséquence assumée : PostgreSQL ne peut pas agréger les montants (SUM), les
 * totaux sont donc calculés en mémoire après déchiffrement. Acceptable pour un
 * usage personnel ; à revoir si un utilisateur dépasse quelques milliers de
 * lignes.
 */

import { encryptValue, decryptValue } from '../utils/crypto.js'
import { CATEGORY_USAGE } from './categories.js'

const TITLE_USAGE  = 'transaction-title'
const AMOUNT_USAGE = 'transaction-amount'

const TYPES = ['expense', 'income']

const transactionSchema = {
  type: 'object',
  properties: {
    id:     { type: 'string', format: 'uuid' },
    title:  { type: 'string' },
    amount: { type: 'integer', description: 'Montant en centimes, toujours positif' },
    date:   { type: 'string' },
    type:   { type: 'string', enum: TYPES },
    note:   { type: 'string', nullable: true },
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
function toApi(transaction: any) {
  return {
    id:     transaction.id,
    title:  decryptValue(transaction.titleEncrypted, TITLE_USAGE),
    amount: parseInt(decryptValue(transaction.amountEncrypted, AMOUNT_USAGE), 10),
    date:   formatDate(transaction.date),
    type:   transaction.type,
    note:   transaction.note,
    category: transaction.category
      ? {
          id:    transaction.category.id,
          name:  decryptValue(transaction.category.nameEncrypted, CATEGORY_USAGE),
          color: transaction.category.color,
        }
      : null,
  }
}

/** Vérifie que la catégorie appartient bien à l'utilisateur. */
async function assertCategoryOwned(fastify: any, userId: string, categoryId?: string | null) {
  if (!categoryId) return true

  const category = await fastify.prisma.category.findFirst({
    where:  { id: categoryId, userId },
    select: { id: true },
  })

  return !!category
}

export default async function transactionRoutes(fastify: any) {
  // ── GET /api/transactions ───────────────────────────────
  fastify.get('/api/transactions', {
    schema: {
      summary: 'Lister les transactions (filtrables, paginées)',
      tags: ['transactions'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          type:       { type: 'string', enum: TYPES },
          categoryId: { type: 'string', format: 'uuid' },
          from:       { type: 'string', format: 'date' },
          to:         { type: 'string', format: 'date' },
          limit:      { type: 'integer', minimum: 1, maximum: 200, default: 50 },
          offset:     { type: 'integer', minimum: 0, default: 0 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            items: { type: 'array', items: transactionSchema },
            total: { type: 'integer' },
          },
        },
        401: errorSchema,
      },
    },
    preHandler: fastify.authenticate,
  }, async (req: any) => {
    const { type, categoryId, from, to, limit = 50, offset = 0 } = req.query

    const where: any = { userId: req.user.userId }
    if (type)       where.type = type
    if (categoryId) where.categoryId = categoryId
    if (from || to) {
      where.date = {
        ...(from && { gte: new Date(from) }),
        ...(to   && { lte: new Date(to) }),
      }
    }

    const [items, total] = await Promise.all([
      fastify.prisma.transaction.findMany({
        where,
        include: { category: true },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      fastify.prisma.transaction.count({ where }),
    ])

    return { items: items.map(toApi), total }
  })

  // ── GET /api/summary ────────────────────────────────────
  fastify.get('/api/summary', {
    schema: {
      summary: 'Solde, totaux du mois et dernières transactions',
      tags: ['transactions'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            balance:      { type: 'integer', description: 'Revenus - dépenses, en centimes' },
            income:       { type: 'integer' },
            expense:      { type: 'integer' },
            monthIncome:  { type: 'integer' },
            monthExpense: { type: 'integer' },
            month:        { type: 'string', description: 'Mois courant, yyyy-mm' },
            count:        { type: 'integer' },
            recent:       { type: 'array', items: transactionSchema },
          },
        },
        401: errorSchema,
      },
    },
    preHandler: fastify.authenticate,
  }, async (req: any) => {
    const transactions = await fastify.prisma.transaction.findMany({
      where:   { userId: req.user.userId },
      include: { category: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    })

    const decrypted = transactions.map(toApi)

    const now       = new Date()
    const monthKey  = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    const inMonth   = (t: any) => t.date.startsWith(monthKey)
    const sum       = (list: any[]) => list.reduce((total, t) => total + t.amount, 0)

    const income       = sum(decrypted.filter((t) => t.type === 'income'))
    const expense      = sum(decrypted.filter((t) => t.type === 'expense'))
    const monthIncome  = sum(decrypted.filter((t) => t.type === 'income'  && inMonth(t)))
    const monthExpense = sum(decrypted.filter((t) => t.type === 'expense' && inMonth(t)))

    return {
      balance: income - expense,
      income,
      expense,
      monthIncome,
      monthExpense,
      month:  monthKey,
      count:  decrypted.length,
      recent: decrypted.slice(0, 5),
    }
  })

  // ── POST /api/transactions ──────────────────────────────
  fastify.post('/api/transactions', {
    schema: {
      summary: 'Créer une transaction',
      tags: ['transactions'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['title', 'amount', 'date'],
        properties: {
          title:      { type: 'string', minLength: 1, maxLength: 120 },
          amount:     { type: 'integer', minimum: 1, description: 'Centimes, positif' },
          date:       { type: 'string', format: 'date' },
          type:       { type: 'string', enum: TYPES, default: 'expense' },
          categoryId: { type: 'string', format: 'uuid', nullable: true },
          note:       { type: 'string', maxLength: 500, nullable: true },
        },
      },
      response: { 201: transactionSchema, 400: errorSchema, 401: errorSchema },
    },
    preHandler: fastify.authenticate,
  }, async (req: any, reply: any) => {
    const { title, amount, date, type = 'expense', categoryId = null, note = null } = req.body

    if (!(await assertCategoryOwned(fastify, req.user.userId, categoryId))) {
      return reply.code(400).send({ error: 'Catégorie introuvable.', code: 'CATEGORY_NOT_FOUND' })
    }

    const transaction = await fastify.prisma.transaction.create({
      data: {
        userId:          req.user.userId,
        categoryId,
        titleEncrypted:  encryptValue(title.trim(), TITLE_USAGE),
        amountEncrypted: encryptValue(String(amount), AMOUNT_USAGE),
        date:            new Date(date),
        type,
        note,
      },
      include: { category: true },
    })

    return reply.code(201).send(toApi(transaction))
  })

  // ── PUT /api/transactions/:id ───────────────────────────
  fastify.put('/api/transactions/:id', {
    schema: {
      summary: 'Modifier une transaction',
      tags: ['transactions'],
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
          date:       { type: 'string', format: 'date' },
          type:       { type: 'string', enum: TYPES },
          categoryId: { type: 'string', format: 'uuid', nullable: true },
          note:       { type: 'string', maxLength: 500, nullable: true },
        },
      },
      response: { 200: transactionSchema, 400: errorSchema, 401: errorSchema, 404: errorSchema },
    },
    preHandler: fastify.authenticate,
  }, async (req: any, reply: any) => {
    const existing = await fastify.prisma.transaction.findFirst({
      where:  { id: req.params.id, userId: req.user.userId },
      select: { id: true },
    })

    if (!existing) {
      return reply.code(404).send({ error: 'Transaction introuvable.', code: 'TRANSACTION_NOT_FOUND' })
    }

    const { title, amount, date, type, categoryId, note } = req.body

    if (categoryId !== undefined && !(await assertCategoryOwned(fastify, req.user.userId, categoryId))) {
      return reply.code(400).send({ error: 'Catégorie introuvable.', code: 'CATEGORY_NOT_FOUND' })
    }

    const transaction = await fastify.prisma.transaction.update({
      where: { id: req.params.id },
      data: {
        ...(title      !== undefined && { titleEncrypted:  encryptValue(title.trim(), TITLE_USAGE) }),
        ...(amount     !== undefined && { amountEncrypted: encryptValue(String(amount), AMOUNT_USAGE) }),
        ...(date       !== undefined && { date: new Date(date) }),
        ...(type       !== undefined && { type }),
        ...(categoryId !== undefined && { categoryId }),
        ...(note       !== undefined && { note }),
      },
      include: { category: true },
    })

    return reply.code(200).send(toApi(transaction))
  })

  // ── DELETE /api/transactions/:id ────────────────────────
  fastify.delete('/api/transactions/:id', {
    schema: {
      summary: 'Supprimer une transaction',
      tags: ['transactions'],
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
    const existing = await fastify.prisma.transaction.findFirst({
      where:  { id: req.params.id, userId: req.user.userId },
      select: { id: true },
    })

    if (!existing) {
      return reply.code(404).send({ error: 'Transaction introuvable.', code: 'TRANSACTION_NOT_FOUND' })
    }

    await fastify.prisma.transaction.delete({ where: { id: req.params.id } })

    return reply.code(200).send({ id: req.params.id, deleted: true })
  })
}

export { TITLE_USAGE, AMOUNT_USAGE }
