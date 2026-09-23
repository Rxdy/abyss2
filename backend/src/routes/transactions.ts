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

import type { FastifyInstance } from 'fastify'
import type { Category, Prisma, Transaction } from '@prisma/client'
import { encryptValue, decryptValue } from '../utils/crypto.js'
import type { TransactionType } from '../types.js'
import { currentMonthKey } from '../utils/date.js'
import { CATEGORY_USAGE } from './categories.js'
import { runDueRecurring } from '../utils/recurring.js'
import { checkEnvelopeOverspend } from '../utils/notifications.js'

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
    recurringId: { type: 'string', format: 'uuid', nullable: true, description: 'Renseigné si générée depuis une charge fixe' },
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

/**
 * Ligne Prisma (+ catégorie jointe) → objet exposé par l'API.
 * `categoryNames` : cache id → nom déchiffré, à partager entre les lignes d'une
 * même réponse (une catégorie revient sur des dizaines de lignes).
 */
function toApi(transaction: Transaction & { category?: Category | null }, categoryNames: Map<string, string> = new Map()) {
  const categoryName = (category: Category) => {
    let name = categoryNames.get(category.id)
    if (name === undefined) {
      name = decryptValue(category.nameEncrypted, CATEGORY_USAGE)
      categoryNames.set(category.id, name)
    }
    return name
  }

  return {
    id:     transaction.id,
    title:  decryptValue(transaction.titleEncrypted, TITLE_USAGE),
    amount: parseInt(decryptValue(transaction.amountEncrypted, AMOUNT_USAGE), 10),
    date:   formatDate(transaction.date),
    type:   transaction.type,
    note:   transaction.note,
    recurringId: transaction.recurringId ?? null,
    category: transaction.category
      ? {
          id:    transaction.category.id,
          name:  categoryName(transaction.category),
          color: transaction.category.color,
        }
      : null,
  }
}

/** Vérifie que la catégorie appartient bien à l'utilisateur. */
async function assertCategoryOwned(fastify: FastifyInstance, userId: string, categoryId?: string | null) {
  if (!categoryId) return true

  const category = await fastify.prisma.category.findFirst({
    where:  { id: categoryId, userId },
    select: { id: true },
  })

  return !!category
}

interface TransactionBody {
  title?: string
  /** Centimes, positif */
  amount?: number
  /** yyyy-mm-dd */
  date?: string
  type?: TransactionType
  categoryId?: string | null
  note?: string | null
}

export default async function transactionRoutes(fastify: FastifyInstance) {
  // ── GET /api/transactions ───────────────────────────────
  fastify.get<{ Querystring: { type?: TransactionType; categoryId?: string; from?: string; to?: string; limit?: number; offset?: number } }>('/api/transactions', {
    schema: {
      summary: 'Lister les transactions (filtrables, paginées)',
      tags: ['transactions'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          type:       { type: 'string', enum: TYPES },
          categoryId: { type: 'string', description: 'UUID d\'une catégorie, ou "none" pour les transactions sans catégorie' },
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
        400: errorSchema,
        401: errorSchema,
      },
    },
    preHandler: fastify.authenticate,
  }, async (req, reply) => {
    const { type, categoryId, from, to, limit = 50, offset = 0 } = req.query

    if (from && to && new Date(to) < new Date(from)) {
      return reply.code(400).send({ error: 'La date de fin doit être après la date de début.', code: 'END_BEFORE_START' })
    }

    await runDueRecurring(fastify.prisma, req.user.userId)

    const where: Prisma.TransactionWhereInput = { userId: req.user.userId }
    if (type) where.type = type
    if (categoryId === 'none') where.categoryId = null
    else if (categoryId)       where.categoryId = categoryId
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

    const categoryNames = new Map<string, string>()
    return { items: items.map((row) => toApi(row, categoryNames)), total }
  })

  // ── GET /api/summary ────────────────────────────────────
  // Solde global + totaux d'un mois (le mois courant par défaut) + les dernières
  // transactions de ce mois.
  //
  // Coût : chaque montant est chiffré, donc le solde oblige à tous les déchiffrer. On ne lit que ce qui
  // sert (montant, type, date — ni libellé, ni catégorie) et les lignes détaillées ne portent que sur
  // les 5 du mois affiché : ≈ 2× moins de déchiffrements que de tout décoder ligne par ligne.
  fastify.get<{ Querystring: { month?: string } }>('/api/summary', {
    schema: {
      summary: 'Solde, totaux d\'un mois et dernières transactions de ce mois',
      tags: ['transactions'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          month: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$', description: 'Mois affiché, yyyy-mm (défaut : mois courant)' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            balance:      { type: 'integer', description: 'Revenus - dépenses, en centimes' },
            income:       { type: 'integer' },
            expense:      { type: 'integer' },
            monthIncome:  { type: 'integer' },
            monthExpense: { type: 'integer' },
            month:        { type: 'string', description: 'Mois des totaux, yyyy-mm' },
            currentMonth: { type: 'string', description: 'Mois courant, yyyy-mm — borne haute de la navigation' },
            firstMonth:   { type: 'string', nullable: true, description: 'Mois de la plus ancienne transaction — borne basse de la navigation' },
            count:        { type: 'integer' },
            recent:       { type: 'array', items: transactionSchema },
          },
        },
        400: errorSchema,
        401: errorSchema,
      },
    },
    preHandler: fastify.authenticate,
  }, async (req) => {
    const userId = req.user.userId
    await runDueRecurring(fastify.prisma, userId)

    const currentMonth = currentMonthKey()
    const month = req.query.month ?? currentMonth
    const [year, monthNumber] = month.split('-').map(Number)
    const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1))
    const monthEnd   = new Date(Date.UTC(year, monthNumber, 0))

    const [rows, recentRows] = await Promise.all([
      fastify.prisma.transaction.findMany({
        where:  { userId },
        select: { amountEncrypted: true, type: true, date: true },
      }),
      fastify.prisma.transaction.findMany({
        where:   { userId, date: { gte: monthStart, lte: monthEnd } },
        include: { category: true },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take:    5,
      }),
    ])

    const totals = { income: 0, expense: 0, monthIncome: 0, monthExpense: 0 }
    let firstMonth: string | null = null

    for (const row of rows) {
      const amount = parseInt(decryptValue(row.amountEncrypted, AMOUNT_USAGE), 10)
      const rowMonth = row.date.toISOString().slice(0, 7)
      const isIncome = row.type === 'income'

      if (isIncome) totals.income += amount; else totals.expense += amount
      if (rowMonth === month) {
        if (isIncome) totals.monthIncome += amount; else totals.monthExpense += amount
      }
      if (firstMonth === null || rowMonth < firstMonth) firstMonth = rowMonth
    }

    const categoryNames = new Map<string, string>()

    return {
      balance: totals.income - totals.expense,
      income:  totals.income,
      expense: totals.expense,
      monthIncome:  totals.monthIncome,
      monthExpense: totals.monthExpense,
      month,
      currentMonth,
      firstMonth,
      count:  rows.length,
      recent: recentRows.slice(0, 5).map((row) => toApi(row, categoryNames)),
    }
  })

  // ── POST /api/transactions ──────────────────────────────
  fastify.post<{ Body: TransactionBody & { title: string; amount: number; date: string } }>('/api/transactions', {
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
    preHandler: [fastify.authenticate, fastify.csrfIfCookie],
  }, async (req, reply) => {
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

    if (type === 'expense') {
      await checkEnvelopeOverspend(fastify.prisma, req.user.userId, categoryId, amount)
    }

    return reply.code(201).send(toApi(transaction))
  })

  // ── PUT /api/transactions/:id ───────────────────────────
  fastify.put<{ Params: { id: string }; Body: TransactionBody }>('/api/transactions/:id', {
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
      response: { 200: transactionSchema, 400: errorSchema, 401: errorSchema, 404: errorSchema, 409: errorSchema },
    },
    preHandler: [fastify.authenticate, fastify.csrfIfCookie],
  }, async (req, reply) => {
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

    let transaction
    try {
      transaction = await fastify.prisma.transaction.update({
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
    } catch (err) {
      // Index unique (charge fixe, date) : deux échéances d'une même charge ne peuvent pas partager une date.
      if (err instanceof Error && (err as { code?: string }).code === 'P2002') {
        return reply.code(409).send({
          error: 'Une échéance de cette charge fixe existe déjà à cette date.',
          code:  'DUPLICATE_OCCURRENCE',
        })
      }
      throw err
    }

    return reply.code(200).send(toApi(transaction))
  })

  // ── DELETE /api/transactions/:id ────────────────────────
  fastify.delete<{ Params: { id: string } }>('/api/transactions/:id', {
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
    preHandler: [fastify.authenticate, fastify.csrfIfCookie],
  }, async (req, reply) => {
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

export { TITLE_USAGE, AMOUNT_USAGE, assertCategoryOwned }
