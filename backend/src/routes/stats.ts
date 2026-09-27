/**
 * Route /api/stats — répartition des dépenses (ou revenus) par catégorie
 * sur une période donnée, en pourcentage du total.
 *
 * Les sous-catégories sont recomptées dans le total de leur catégorie
 * parente (le pourcentage affiché en haut de liste correspond bien à
 * "Alimentation" dans son ensemble), tout en restant listées à part avec
 * leur propre part de ce sous-total — pour pouvoir zoomer si besoin.
 */

import type { FastifyInstance } from 'fastify'
import { decryptValue } from '../utils/crypto.js'
import type { TransactionType } from '../types.js'
import { CATEGORY_USAGE } from './categories.js'
import { AMOUNT_USAGE } from './transactions.js'
import { runDueRecurring } from '../utils/recurring.js'

const TYPES = ['expense', 'income']

const errorSchema = {
  type: 'object',
  properties: { error: { type: 'string' }, code: { type: 'string' } },
}

const categoryStatSchema = {
  type: 'object',
  properties: {
    id:         { type: 'string', nullable: true },
    name:       { type: 'string' },
    color:      { type: 'string', nullable: true },
    amount:     { type: 'integer' },
    percentage: { type: 'number' },
  },
}

/** Une catégorie (ou sous-catégorie) et ce qui y a été dépensé sur la période, avant calcul des pourcentages. */
interface CategoryStat {
  id: string | null
  name: string
  color: string | null
  amount: number
  children: { id: string; name: string; color: string | null; amount: number; percentage: number }[]
}

/** Arrondi à une décimale — évite les 33.333333333333336 %. */
function round1(value: number) {
  return Math.round(value * 10) / 10
}

function percentageOf(amount: number, total: number) {
  return total > 0 ? round1((amount / total) * 100) : 0
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Amplitude maximale d'une période : au-delà, la réponse (une entrée par jour/mois) devient énorme. */
const MAX_RANGE_DAYS = 366 * 10

function daysBetween(from: string, to: string) {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / MS_PER_DAY)
}

/** Toutes les clés jour ('YYYY-MM-DD') entre from et to, bornes incluses. */
function enumerateDays(from: string, to: string) {
  const keys: string[] = []
  const cursor = new Date(from)
  const end = new Date(to)
  while (cursor <= end) {
    keys.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return keys
}

/** Toutes les clés mois ('YYYY-MM') entre from et to, bornes incluses. */
function enumerateMonths(from: string, to: string) {
  const keys: string[] = []
  const cursor = new Date(from)
  cursor.setUTCDate(1)
  const end = new Date(to)
  while (cursor <= end) {
    keys.push(cursor.toISOString().slice(0, 7))
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }
  return keys
}

export default async function statsRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: { from: string; to: string; type?: TransactionType } }>('/api/stats', {
    schema: {
      summary: 'Répartition des dépenses/revenus par catégorie sur une période',
      tags: ['stats'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['from', 'to'],
        properties: {
          from: { type: 'string', format: 'date' },
          to:   { type: 'string', format: 'date' },
          type: { type: 'string', enum: TYPES, default: 'expense' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            from:       { type: 'string' },
            to:         { type: 'string' },
            type:       { type: 'string', enum: TYPES },
            total:      { type: 'integer' },
            categories: {
              type: 'array',
              items: {
                ...categoryStatSchema,
                properties: {
                  ...categoryStatSchema.properties,
                  children: { type: 'array', items: categoryStatSchema },
                },
              },
            },
            timeseries: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  date:   { type: 'string' },
                  amount: { type: 'integer' },
                },
              },
            },
          },
        },
        400: errorSchema,
        401: errorSchema,
      },
    },
    preHandler: fastify.authenticate,
  }, async (req, reply) => {
    const { from, to, type = 'expense' } = req.query

    if (new Date(to) < new Date(from)) {
      return reply.code(400).send({ error: 'La date de fin doit être après la date de début.', code: 'END_BEFORE_START' })
    }

    if (daysBetween(from, to) > MAX_RANGE_DAYS) {
      return reply.code(400).send({ error: 'La période ne peut pas dépasser 10 ans.', code: 'RANGE_TOO_LARGE' })
    }

    await runDueRecurring(fastify.prisma, req.user.userId)

    const [transactions, categories] = await Promise.all([
      fastify.prisma.transaction.findMany({
        where: {
          userId: req.user.userId,
          type,
          date: { gte: new Date(from), lte: new Date(to) },
        },
        select: { amountEncrypted: true, categoryId: true, date: true },
      }),
      fastify.prisma.category.findMany({ where: { userId: req.user.userId } }),
    ])

    // Au-delà de ~2 mois le détail jour par jour devient illisible : on
    // bascule sur une agrégation mensuelle.
    const granularity: 'day' | 'month' = daysBetween(from, to) > 62 ? 'month' : 'day'
    const periodLength = granularity === 'day' ? 10 : 7

    const amountByCategory = new Map<string, number>() // 'none' pour sans catégorie
    const amountByPeriod   = new Map<string, number>()
    let total = 0

    for (const transaction of transactions) {
      const amount = parseInt(decryptValue(transaction.amountEncrypted, AMOUNT_USAGE), 10)
      const key = transaction.categoryId ?? 'none'
      amountByCategory.set(key, (amountByCategory.get(key) ?? 0) + amount)
      total += amount

      const periodKey = transaction.date.toISOString().slice(0, periodLength)
      amountByPeriod.set(periodKey, (amountByPeriod.get(periodKey) ?? 0) + amount)
    }

    const periodKeys = granularity === 'day' ? enumerateDays(from, to) : enumerateMonths(from, to)
    const timeseries = periodKeys.map((date) => ({ date, amount: amountByPeriod.get(date) ?? 0 }))

    const topLevel = categories.filter((c) => !c.parentId)
    const childrenOf = (id: string) => categories.filter((c) => c.parentId === id)

    const entries: CategoryStat[] = topLevel.map((category) => {
      const ownAmount = amountByCategory.get(category.id) ?? 0

      const children = childrenOf(category.id)
        .map((child) => ({
          id:     child.id,
          name:   decryptValue(child.nameEncrypted, CATEGORY_USAGE),
          color:  child.color,
          amount: amountByCategory.get(child.id) ?? 0,
        }))
        .filter((child) => child.amount > 0)
        .sort((a, b) => b.amount - a.amount)

      const amount = ownAmount + children.reduce((sum, c) => sum + c.amount, 0)

      return {
        id:     category.id,
        name:   decryptValue(category.nameEncrypted, CATEGORY_USAGE),
        color:  category.color,
        amount,
        children: children.map((child) => ({ ...child, percentage: percentageOf(child.amount, amount) })),
      }
    }).filter((entry) => entry.amount > 0)

    const noneAmount = amountByCategory.get('none') ?? 0
    if (noneAmount > 0) {
      entries.push({ id: null, name: 'Sans catégorie', color: null, amount: noneAmount, children: [] })
    }

    entries.sort((a, b) => b.amount - a.amount)

    const result = entries.map((entry) => ({ ...entry, percentage: percentageOf(entry.amount, total) }))

    return { from, to, type, total, categories: result, timeseries }
  })

  fastify.get<{ Querystring: { type?: TransactionType } }>('/api/stats/periods', {
    schema: {
      summary: 'Mois et années disposant de transactions, pour peupler les sélecteurs de période',
      tags: ['stats'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: TYPES, default: 'expense' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            months: { type: 'array', items: { type: 'string' } },
            years:  { type: 'array', items: { type: 'string' } },
          },
        },
        401: errorSchema,
      },
    },
    preHandler: fastify.authenticate,
  }, async (req) => {
    const { type = 'expense' } = req.query

    await runDueRecurring(fastify.prisma, req.user.userId)

    const rows = await fastify.prisma.transaction.findMany({
      where: { userId: req.user.userId, type },
      select: { date: true },
      distinct: ['date'],
    })

    const months = new Set<string>()
    const years  = new Set<string>()

    for (const row of rows) {
      const iso = row.date.toISOString()
      months.add(iso.slice(0, 7))
      years.add(iso.slice(0, 4))
    }

    return {
      months: [...months].sort().reverse(),
      years:  [...years].sort().reverse(),
    }
  })
}
