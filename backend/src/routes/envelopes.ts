/**
 * Routes /api/envelopes
 *
 * Une enveloppe regroupe plusieurs catégories sous un même plafond mensuel
 * (voir todo.md). Le nom et le montant alloué sont chiffrés en base, comme
 * le libellé et le budget d'une catégorie. Le calcul du dépensé (somme des
 * catégories liées sur le mois affiché) reste côté client (utils/budget.js),
 * l'API ne fait que porter l'enveloppe et la liste de ses catégories.
 *
 * Le plafond n'est jamais bloquant : dépasser une enveloppe, ou allouer plus
 * que les revenus du mois, ne refuse jamais la création/modification d'une
 * transaction ou d'une enveloppe — seule l'interface l'affiche en alerte.
 */

import type { FastifyInstance } from 'fastify'
import type { Envelope } from '@prisma/client'
import { encryptValue, decryptValue } from '../utils/crypto.js'
import type { ApiError } from '../types.js'

const NAME_USAGE   = 'envelope-name'
const BUDGET_USAGE = 'envelope-budget'

/** Montant alloué maximal accepté, en centimes (1 000 000 €). */
const BUDGET_MAX = 100_000_000

const envelopeSchema = {
  type: 'object',
  properties: {
    id:          { type: 'string', format: 'uuid' },
    name:        { type: 'string' },
    budget:      { type: 'integer', description: 'Montant alloué par mois, en centimes' },
    categoryIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
  },
}

const errorSchema = {
  type: 'object',
  properties: { error: { type: 'string' }, code: { type: 'string' } },
}

type EnvelopeWithCategories = Envelope & { categories: { id: string }[] }

/** Ligne Prisma (+ catégories liées) → objet exposé par l'API. */
function toApi(envelope: EnvelopeWithCategories) {
  return {
    id:          envelope.id,
    name:        decryptValue(envelope.nameEncrypted, NAME_USAGE),
    budget:      parseInt(decryptValue(envelope.budgetEncrypted, BUDGET_USAGE), 10),
    categoryIds: envelope.categories.map((category) => category.id),
  }
}

/**
 * Vérifie que chaque id de `categoryIds` existe et appartient à l'utilisateur.
 * Renvoie un message d'erreur (code inclus) ou `null` si tout va bien.
 */
async function validateCategoryIds(fastify: FastifyInstance, userId: string, categoryIds: string[]): Promise<ApiError | null> {
  if (categoryIds.length === 0) return null

  const count = await fastify.prisma.category.count({
    where: { id: { in: categoryIds }, userId },
  })

  if (count !== new Set(categoryIds).size) {
    return { code: 'CATEGORY_NOT_FOUND', error: 'Une des catégories liées est introuvable.' }
  }

  return null
}

/**
 * Aligne `Category.envelopeId` sur `categoryIds` pour l'enveloppe `envelopeId` :
 * détache les catégories qui n'y sont plus, rattache les nouvelles. Les
 * catégories déjà liées à une autre enveloppe en sont détachées (une
 * catégorie n'appartient jamais qu'à une seule enveloppe à la fois).
 */
async function syncCategories(fastify: FastifyInstance, userId: string, envelopeId: string, categoryIds: string[]) {
  await fastify.prisma.category.updateMany({
    where: { userId, envelopeId, id: { notIn: categoryIds } },
    data:  { envelopeId: null },
  })

  if (categoryIds.length > 0) {
    await fastify.prisma.category.updateMany({
      where: { userId, id: { in: categoryIds } },
      data:  { envelopeId },
    })
  }
}

interface EnvelopeBody {
  name?: string
  budget?: number
  categoryIds?: string[]
}

export default async function envelopeRoutes(fastify: FastifyInstance) {
  // ── GET /api/envelopes ───────────────────────────────────
  fastify.get('/api/envelopes', {
    schema: {
      summary: 'Lister les enveloppes de l\'utilisateur',
      tags: ['envelopes'],
      security: [{ bearerAuth: [] }],
      response: { 200: { type: 'array', items: envelopeSchema }, 401: errorSchema },
    },
    preHandler: fastify.authenticate,
  }, async (req) => {
    const envelopes = await fastify.prisma.envelope.findMany({
      where:   { userId: req.user.userId },
      orderBy: { createdAt: 'asc' },
      include: { categories: { select: { id: true } } },
    })

    return envelopes.map(toApi)
  })

  // ── POST /api/envelopes ──────────────────────────────────
  fastify.post<{ Body: EnvelopeBody & { name: string; budget: number } }>('/api/envelopes', {
    schema: {
      summary: 'Créer une enveloppe',
      tags: ['envelopes'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'budget'],
        properties: {
          name:        { type: 'string', minLength: 1, maxLength: 60 },
          budget:      { type: 'integer', minimum: 1, maximum: BUDGET_MAX, description: 'Montant alloué par mois, en centimes' },
          categoryIds: { type: 'array', items: { type: 'string', format: 'uuid' }, default: [] },
        },
      },
      response: { 201: envelopeSchema, 400: errorSchema, 401: errorSchema },
    },
    preHandler: [fastify.authenticate, fastify.csrfIfCookie],
  }, async (req, reply) => {
    const { name, budget, categoryIds = [] } = req.body

    const categoryError = await validateCategoryIds(fastify, req.user.userId, categoryIds)
    if (categoryError) return reply.code(400).send(categoryError)

    const envelope = await fastify.prisma.envelope.create({
      data: {
        userId:          req.user.userId,
        nameEncrypted:   encryptValue(name.trim(), NAME_USAGE),
        budgetEncrypted: encryptValue(String(budget), BUDGET_USAGE),
      },
    })

    await syncCategories(fastify, req.user.userId, envelope.id, categoryIds)

    const withCategories = await fastify.prisma.envelope.findUniqueOrThrow({
      where:   { id: envelope.id },
      include: { categories: { select: { id: true } } },
    })

    return reply.code(201).send(toApi(withCategories))
  })

  // ── PUT /api/envelopes/:id ────────────────────────────────
  fastify.put<{ Params: { id: string }; Body: EnvelopeBody }>('/api/envelopes/:id', {
    schema: {
      summary: 'Modifier une enveloppe',
      tags: ['envelopes'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        properties: {
          name:        { type: 'string', minLength: 1, maxLength: 60 },
          budget:      { type: 'integer', minimum: 1, maximum: BUDGET_MAX, description: 'Montant alloué par mois, en centimes' },
          categoryIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
        },
      },
      response: { 200: envelopeSchema, 400: errorSchema, 401: errorSchema, 404: errorSchema },
    },
    preHandler: [fastify.authenticate, fastify.csrfIfCookie],
  }, async (req, reply) => {
    const existing = await fastify.prisma.envelope.findFirst({
      where:  { id: req.params.id, userId: req.user.userId },
      select: { id: true },
    })

    if (!existing) {
      return reply.code(404).send({ error: 'Enveloppe introuvable.', code: 'ENVELOPE_NOT_FOUND' })
    }

    const { name, budget, categoryIds } = req.body

    if (categoryIds !== undefined) {
      const categoryError = await validateCategoryIds(fastify, req.user.userId, categoryIds)
      if (categoryError) return reply.code(400).send(categoryError)
    }

    await fastify.prisma.envelope.update({
      where: { id: req.params.id },
      data: {
        ...(name   !== undefined && { nameEncrypted: encryptValue(name.trim(), NAME_USAGE) }),
        ...(budget !== undefined && { budgetEncrypted: encryptValue(String(budget), BUDGET_USAGE) }),
      },
    })

    if (categoryIds !== undefined) {
      await syncCategories(fastify, req.user.userId, req.params.id, categoryIds)
    }

    const withCategories = await fastify.prisma.envelope.findUniqueOrThrow({
      where:   { id: req.params.id },
      include: { categories: { select: { id: true } } },
    })

    return reply.code(200).send(toApi(withCategories))
  })

  // ── DELETE /api/envelopes/:id ─────────────────────────────
  // Les catégories liées sont conservées, juste détachées (envelope_id → NULL).
  fastify.delete<{ Params: { id: string } }>('/api/envelopes/:id', {
    schema: {
      summary: 'Supprimer une enveloppe',
      tags: ['envelopes'],
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
    const existing = await fastify.prisma.envelope.findFirst({
      where:  { id: req.params.id, userId: req.user.userId },
      select: { id: true },
    })

    if (!existing) {
      return reply.code(404).send({ error: 'Enveloppe introuvable.', code: 'ENVELOPE_NOT_FOUND' })
    }

    await fastify.prisma.envelope.delete({ where: { id: req.params.id } })

    return reply.code(200).send({ id: req.params.id, deleted: true })
  })
}
