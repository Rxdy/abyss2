/**
 * Route /api/stats — répartition des dépenses (ou revenus) par catégorie
 * sur une période donnée, en pourcentage du total.
 *
 * Les sous-catégories sont recomptées dans le total de leur catégorie
 * parente (le pourcentage affiché en haut de liste correspond bien à
 * "Alimentation" dans son ensemble), tout en restant listées à part avec
 * leur propre part de ce sous-total — pour pouvoir zoomer si besoin.
 */

import { decryptValue } from '../utils/crypto.js'
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

/** Arrondi à une décimale — évite les 33.333333333333336 %. */
function round1(value: number) {
  return Math.round(value * 10) / 10
}

function percentageOf(amount: number, total: number) {
  return total > 0 ? round1((amount / total) * 100) : 0
}

export default async function statsRoutes(fastify: any) {
  fastify.get('/api/stats', {
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
          },
        },
        400: errorSchema,
        401: errorSchema,
      },
    },
    preHandler: fastify.authenticate,
  }, async (req: any, reply: any) => {
    const { from, to, type = 'expense' } = req.query

    if (new Date(to) < new Date(from)) {
      return reply.code(400).send({ error: 'La date de fin doit être après la date de début.', code: 'END_BEFORE_START' })
    }

    await runDueRecurring(fastify.prisma, req.user.userId)

    const [transactions, categories] = await Promise.all([
      fastify.prisma.transaction.findMany({
        where: {
          userId: req.user.userId,
          type,
          date: { gte: new Date(from), lte: new Date(to) },
        },
        select: { amountEncrypted: true, categoryId: true },
      }),
      fastify.prisma.category.findMany({ where: { userId: req.user.userId } }),
    ])

    const amountByCategory = new Map<string, number>() // 'none' pour sans catégorie
    let total = 0

    for (const transaction of transactions) {
      const amount = parseInt(decryptValue(transaction.amountEncrypted, AMOUNT_USAGE), 10)
      const key = transaction.categoryId ?? 'none'
      amountByCategory.set(key, (amountByCategory.get(key) ?? 0) + amount)
      total += amount
    }

    const topLevel = categories.filter((c: any) => !c.parentId)
    const childrenOf = (id: string) => categories.filter((c: any) => c.parentId === id)

    const entries = topLevel.map((category: any) => {
      const ownAmount = amountByCategory.get(category.id) ?? 0

      const children = childrenOf(category.id)
        .map((child: any) => ({
          id:     child.id,
          name:   decryptValue(child.nameEncrypted, CATEGORY_USAGE),
          color:  child.color,
          amount: amountByCategory.get(child.id) ?? 0,
        }))
        .filter((child: any) => child.amount > 0)
        .sort((a: any, b: any) => b.amount - a.amount)

      const amount = ownAmount + children.reduce((sum: number, c: any) => sum + c.amount, 0)

      return {
        id:     category.id,
        name:   decryptValue(category.nameEncrypted, CATEGORY_USAGE),
        color:  category.color,
        amount,
        children: children.map((child: any) => ({ ...child, percentage: percentageOf(child.amount, amount) })),
      }
    }).filter((entry: any) => entry.amount > 0)

    const noneAmount = amountByCategory.get('none') ?? 0
    if (noneAmount > 0) {
      entries.push({ id: null, name: 'Sans catégorie', color: null, amount: noneAmount, children: [] })
    }

    entries.sort((a: any, b: any) => b.amount - a.amount)

    const result = entries.map((entry: any) => ({ ...entry, percentage: percentageOf(entry.amount, total) }))

    return { from, to, type, total, categories: result }
  })
}
