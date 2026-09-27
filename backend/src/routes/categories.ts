/**
 * Routes /api/categories
 *
 * Le libellé est chiffré en base (AES-256-GCM) ; la couleur reste en clair,
 * elle ne dit rien de la vie privée de l'utilisateur et sert au rendu.
 * Toutes les routes sont filtrées sur req.user.userId.
 *
 * Sous-catégories : une seule profondeur. Une catégorie qui a déjà des
 * enfants ne peut pas devenir elle-même une sous-catégorie, et on ne peut
 * pas rattacher une catégorie à une sous-catégorie (parent de parent
 * interdit). Supprimer une catégorie qui a des enfants les promeut en
 * catégories de premier niveau (géré par la contrainte ON DELETE SET NULL
 * en base) : on ne perd jamais de structure silencieusement.
 */

import type { FastifyInstance } from 'fastify'
import type { Category } from '@prisma/client'
import { encryptValue, decryptValue } from '../utils/crypto.js'
import type { ApiError } from '../types.js'

const CATEGORY_USAGE = 'category-name'
const BUDGET_USAGE   = 'category-budget'

/** Plafond mensuel maximal accepté, en centimes (1 000 000 €). */
const BUDGET_MAX = 100_000_000

const categorySchema = {
  type: 'object',
  properties: {
    id:               { type: 'string', format: 'uuid' },
    name:             { type: 'string' },
    color:            { type: 'string', nullable: true },
    position:         { type: 'integer', nullable: true },
    budget:           { type: 'integer', nullable: true, description: 'Plafond mensuel en centimes, null : pas de budget' },
    parentId:         { type: 'string', format: 'uuid', nullable: true },
    envelopeId:       { type: 'string', format: 'uuid', nullable: true },
    transactionCount: { type: 'integer' },
    childrenCount:    { type: 'integer' },
  },
}

const errorSchema = {
  type: 'object',
  properties: { error: { type: 'string' }, code: { type: 'string' } },
}

const COUNTS_INCLUDE = { _count: { select: { transactions: true, children: true } } }

/** Ligne Prisma (+ _count éventuel) → objet exposé par l'API. */
function toApi(category: Category & { _count?: { transactions: number; children: number } }) {
  return {
    id:               category.id,
    name:             decryptValue(category.nameEncrypted, CATEGORY_USAGE),
    color:            category.color,
    position:         category.position,
    budget:           category.budgetEncrypted ? parseInt(decryptValue(category.budgetEncrypted, BUDGET_USAGE), 10) : null,
    parentId:         category.parentId ?? null,
    envelopeId:       category.envelopeId ?? null,
    transactionCount: category._count?.transactions ?? 0,
    childrenCount:    category._count?.children ?? 0,
  }
}

/**
 * Valide un parentId envoyé par le client : doit exister, appartenir à
 * l'utilisateur, ne pas être une sous-catégorie (profondeur max = 1), et ne
 * pas créer de boucle sur soi-même. Renvoie un message d'erreur (code inclus)
 * ou `null` si tout va bien.
 */
async function validateParent(fastify: FastifyInstance, userId: string, selfId: string | null, parentId: string): Promise<ApiError | null> {
  if (selfId && parentId === selfId) {
    return { code: 'CATEGORY_SELF_PARENT', error: 'Une catégorie ne peut pas être sa propre catégorie parente.' }
  }

  const parent = await fastify.prisma.category.findFirst({
    where:  { id: parentId, userId },
    select: { id: true, parentId: true },
  })

  if (!parent) {
    return { code: 'PARENT_NOT_FOUND', error: 'Catégorie parente introuvable.' }
  }

  if (parent.parentId) {
    return { code: 'PARENT_TOO_DEEP', error: 'Une sous-catégorie ne peut pas elle-même avoir de sous-catégorie.' }
  }

  return null
}

interface CategoryBody {
  name?: string
  color?: string
  position?: number
  /** Plafond mensuel en centimes ; null le retire. */
  budget?: number | null
  parentId?: string | null
}

export default async function categoryRoutes(fastify: FastifyInstance) {
  // ── GET /api/categories ─────────────────────────────────
  fastify.get('/api/categories', {
    schema: {
      summary: 'Lister les catégories de l\'utilisateur',
      tags: ['categories'],
      security: [{ bearerAuth: [] }],
      response: { 200: { type: 'array', items: categorySchema }, 401: errorSchema },
    },
    preHandler: fastify.authenticate,
  }, async (req) => {
    const categories = await fastify.prisma.category.findMany({
      where:   { userId: req.user.userId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      include: COUNTS_INCLUDE,
    })

    return categories.map(toApi)
  })

  // ── POST /api/categories ────────────────────────────────
  fastify.post<{ Body: CategoryBody & { name: string } }>('/api/categories', {
    schema: {
      summary: 'Créer une catégorie (ou une sous-catégorie via parentId)',
      tags: ['categories'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name:     { type: 'string', minLength: 1, maxLength: 60 },
          color:    { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
          position: { type: 'integer' },
          budget:   { type: 'integer', minimum: 1, maximum: BUDGET_MAX, nullable: true, description: 'Plafond mensuel en centimes ; null retire le budget' },
          parentId: { type: 'string', format: 'uuid', nullable: true },
        },
      },
      response: { 201: categorySchema, 400: errorSchema, 401: errorSchema },
    },
    preHandler: [fastify.authenticate, fastify.csrfIfCookie],
  }, async (req, reply) => {
    const { name, color, position, parentId, budget } = req.body

    if (parentId) {
      const parentError = await validateParent(fastify, req.user.userId, null, parentId)
      if (parentError) return reply.code(400).send(parentError)
    }

    const count = await fastify.prisma.category.count({ where: { userId: req.user.userId } })

    const category = await fastify.prisma.category.create({
      data: {
        userId:        req.user.userId,
        nameEncrypted: encryptValue(name.trim(), CATEGORY_USAGE),
        color:         color ?? null,
        position:      position ?? count,
        budgetEncrypted: budget ? encryptValue(String(budget), BUDGET_USAGE) : null,
        parentId:      parentId ?? null,
      },
    })

    return reply.code(201).send(toApi(category))
  })

  // ── PUT /api/categories/:id ─────────────────────────────
  fastify.put<{ Params: { id: string }; Body: CategoryBody }>('/api/categories/:id', {
    schema: {
      summary: 'Modifier une catégorie',
      tags: ['categories'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        properties: {
          name:     { type: 'string', minLength: 1, maxLength: 60 },
          color:    { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
          position: { type: 'integer' },
          budget:   { type: 'integer', minimum: 1, maximum: BUDGET_MAX, nullable: true, description: 'Plafond mensuel en centimes ; null retire le budget' },
          parentId: { type: 'string', format: 'uuid', nullable: true },
        },
      },
      response: { 200: categorySchema, 400: errorSchema, 401: errorSchema, 404: errorSchema },
    },
    preHandler: [fastify.authenticate, fastify.csrfIfCookie],
  }, async (req, reply) => {
    const existing = await fastify.prisma.category.findFirst({
      where:  { id: req.params.id, userId: req.user.userId },
      include: COUNTS_INCLUDE,
    })

    if (!existing) {
      return reply.code(404).send({ error: 'Catégorie introuvable.', code: 'CATEGORY_NOT_FOUND' })
    }

    const { name, color, position, parentId, budget } = req.body

    if (parentId !== undefined && parentId !== null) {
      const parentError = await validateParent(fastify, req.user.userId, req.params.id, parentId)
      if (parentError) return reply.code(400).send(parentError)

      if (existing._count.children > 0) {
        return reply.code(400).send({
          code:  'CATEGORY_HAS_CHILDREN',
          error: 'Cette catégorie a des sous-catégories : elle ne peut pas devenir elle-même une sous-catégorie.',
        })
      }
    }

    const category = await fastify.prisma.category.update({
      where: { id: req.params.id },
      data: {
        ...(name     !== undefined && { nameEncrypted: encryptValue(name.trim(), CATEGORY_USAGE) }),
        ...(color    !== undefined && { color }),
        ...(position !== undefined && { position }),
        ...(budget   !== undefined && { budgetEncrypted: budget === null ? null : encryptValue(String(budget), BUDGET_USAGE) }),
        ...(parentId !== undefined && { parentId }),
      },
      include: COUNTS_INCLUDE,
    })

    return reply.code(200).send(toApi(category))
  })

  // ── DELETE /api/categories/:id ──────────────────────────
  // Les transactions rattachées sont conservées (category_id → NULL), sauf
  // si `reassignTo` est fourni : elles sont alors basculées vers cette autre
  // catégorie avant la suppression. Les sous-catégories éventuelles sont
  // conservées et promues en catégories de premier niveau.
  fastify.delete<{ Params: { id: string }; Body?: { reassignTo?: string | null } | null }>('/api/categories/:id', {
    schema: {
      summary: 'Supprimer une catégorie',
      tags: ['categories'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        nullable: true,
        properties: {
          reassignTo: {
            type: 'string',
            format: 'uuid',
            nullable: true,
            description: 'Catégorie vers laquelle basculer les transactions concernées avant suppression.',
          },
        },
      },
      response: {
        200: { type: 'object', properties: { id: { type: 'string' }, deleted: { type: 'boolean' } } },
        400: errorSchema,
        401: errorSchema,
        404: errorSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.csrfIfCookie],
  }, async (req, reply) => {
    const existing = await fastify.prisma.category.findFirst({
      where:  { id: req.params.id, userId: req.user.userId },
      select: { id: true },
    })

    if (!existing) {
      return reply.code(404).send({ error: 'Catégorie introuvable.', code: 'CATEGORY_NOT_FOUND' })
    }

    const reassignTo = req.body?.reassignTo

    if (reassignTo) {
      if (reassignTo === req.params.id) {
        return reply.code(400).send({
          code:  'CATEGORY_SELF_REASSIGN',
          error: 'Impossible de recatégoriser vers la catégorie que l\'on supprime.',
        })
      }

      const target = await fastify.prisma.category.findFirst({
        where:  { id: reassignTo, userId: req.user.userId },
        select: { id: true },
      })

      if (!target) {
        return reply.code(400).send({ code: 'PARENT_NOT_FOUND', error: 'Catégorie de destination introuvable.' })
      }
    }

    await fastify.prisma.$transaction(async (tx) => {
      if (reassignTo) {
        await tx.transaction.updateMany({
          where: { userId: req.user.userId, categoryId: req.params.id },
          data:  { categoryId: reassignTo },
        })
      }

      await tx.category.delete({ where: { id: req.params.id } })
    })

    return reply.code(200).send({ id: req.params.id, deleted: true })
  })
}

export { CATEGORY_USAGE, toApi as categoryToApi }
