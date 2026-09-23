import bcrypt from 'bcryptjs'
import type { FastifyInstance } from 'fastify'
import { decryptEmail, decryptValue } from '../utils/crypto.js'
import { centsToDecimal, toCsv } from '../utils/csv.js'
import { evaluatePassword, weakPasswordMessage } from '../utils/passwordStrength.js'
import { clearSession, issueSession } from '../utils/session.js'
import { BCRYPT_ROUNDS } from './auth.js'
import { CATEGORY_USAGE } from './categories.js'
import { TITLE_USAGE, AMOUNT_USAGE } from './transactions.js'

const errorSchema = {
  type: 'object',
  properties: { error: { type: 'string' }, code: { type: 'string' } },
}

/** yyyy-mm-dd, sans dépendre du fuseau local. */
const isoDay = (date: Date) => date.toISOString().slice(0, 10)

const CSV_HEADERS = ['date', 'type', 'amount', 'title', 'category', 'subcategory', 'note']

/** Une catégorie telle qu'exportée (déchiffrée). */
interface ExportedCategory {
  id: string
  name: string
  color: string | null
  position: number | null
  parentId: string | null
}

export default async function userRoutes(fastify: FastifyInstance) {
  // ── GET /api/user ───────────────────────────────────────
  // Sert aussi à valider le JWT au démarrage du front.
  fastify.get('/api/user', {
    schema: {
      summary: "Profil de l'utilisateur connecté",
      tags: ['user'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            id:        { type: 'string', format: 'uuid' },
            email:     { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            csrfToken: { type: 'string', description: 'À renvoyer dans l\'en-tête X-CSRF-Token sur toute requête qui modifie des données' },
          },
        },
        401: {
          type: 'object',
          properties: { error: { type: 'string' }, code: { type: 'string' } },
        },
      },
    },
    preHandler: fastify.authenticate,
  }, async (req, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where:  { id: req.user.userId },
      select: { id: true, emailEncrypted: true, createdAt: true },
    })

    if (!user) {
      return reply.code(401).send({
        error: 'Utilisateur introuvable.',
        code:  'USER_NOT_FOUND',
      })
    }

    return reply.code(200).send({
      id:        user.id,
      email:     decryptEmail(user.emailEncrypted),
      createdAt: user.createdAt,
      // Un appel de plus, mais GET /api/user tourne déjà à chaque démarrage de l'app (validation de
      // session) : c'est l'endroit naturel pour (re)donner un jeton CSRF après un rechargement de page.
      csrfToken: reply.generateCsrf(),
    })
  })

  // ── DELETE /api/user ─────────────────────────────────────
  // Suppression définitive du compte (droit à l'effacement RGPD) : le mot
  // de passe est redemandé pour confirmer. La suppression de la ligne User
  // entraîne, par contrainte ON DELETE CASCADE, celle de toutes ses
  // catégories, transactions et charges fixes — aucune trace ne subsiste.
  fastify.delete<{ Body: { password: string } }>('/api/user', {
    schema: {
      summary: 'Supprimer définitivement le compte et toutes ses données',
      tags: ['user'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['password'],
        properties: { password: { type: 'string' } },
      },
      response: {
        200: { type: 'object', properties: { deleted: { type: 'boolean' } } },
        401: { type: 'object', properties: { error: { type: 'string' }, code: { type: 'string' } } },
      },
    },
    preHandler: [fastify.authenticate, fastify.csrfIfCookie],
  }, async (req, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where:  { id: req.user.userId },
      select: { id: true, passwordHash: true },
    })

    if (!user) {
      return reply.code(401).send({ error: 'Utilisateur introuvable.', code: 'USER_NOT_FOUND' })
    }

    const isValid = await bcrypt.compare(req.body.password, user.passwordHash)
    if (!isValid) {
      return reply.code(401).send({ error: 'Mot de passe incorrect.', code: 'INVALID_CREDENTIALS' })
    }

    await fastify.prisma.user.delete({ where: { id: user.id } })
    clearSession(reply)

    return reply.code(200).send({ deleted: true })
  })

  // ── PUT /api/user/password ──────────────────────────────
  // Change le mot de passe et invalide toutes les autres sessions (jeton
  // ré-émis pour l'appareil courant, qui reste donc connecté).
  fastify.put<{ Body: { currentPassword: string; newPassword: string } }>('/api/user/password', {
    schema: {
      summary: 'Changer le mot de passe (déconnecte les autres appareils)',
      tags: ['user'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword:     { type: 'string', minLength: 8, maxLength: 72 },
        },
      },
      response: {
        200: { type: 'object', properties: { csrfToken: { type: 'string' } } },
        400: errorSchema,
        401: errorSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.csrfIfCookie],
  }, async (req, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where:  { id: req.user.userId },
      select: { id: true, emailEncrypted: true, passwordHash: true },
    })

    if (!user) {
      return reply.code(401).send({ error: 'Utilisateur introuvable.', code: 'USER_NOT_FOUND' })
    }

    const isValid = await bcrypt.compare(req.body.currentPassword, user.passwordHash)
    if (!isValid) {
      return reply.code(401).send({ error: 'Mot de passe actuel incorrect.', code: 'INVALID_CREDENTIALS' })
    }

    if (req.body.newPassword === req.body.currentPassword) {
      return reply.code(400).send({
        error: 'Le nouveau mot de passe doit être différent de l\'actuel.',
        code:  'SAME_PASSWORD',
      })
    }

    const strength = evaluatePassword(req.body.newPassword)
    if (!strength.acceptable) {
      return reply.code(400).send({ error: weakPasswordMessage(strength), code: 'WEAK_PASSWORD' })
    }

    const passwordHash = await bcrypt.hash(req.body.newPassword, BCRYPT_ROUNDS)

    const updated = await fastify.prisma.user.update({
      where: { id: user.id },
      data:  { passwordHash, tokenVersion: { increment: 1 } },
      select: { tokenVersion: true },
    })

    // Ré-émet la session pour CET appareil (nouveau tokenVersion) : il reste connecté, les autres
    // (qui présentent l'ancien) seront rejetés par `authenticate` à leur prochaine requête.
    const { csrfToken } = issueSession(fastify, reply, {
      id: user.id,
      email: decryptEmail(user.emailEncrypted),
      tokenVersion: updated.tokenVersion,
    })

    return reply.code(200).send({ csrfToken })
  })

  // ── GET /api/user/export ────────────────────────────────
  // Export de toutes les données de l'utilisateur, déchiffrées (droit à la
  // portabilité RGPD). `json` : catégories, transactions et charges fixes ;
  // `csv` : les transactions, à plat, pour un tableur.
  fastify.get<{ Querystring: { format?: 'json' | 'csv' } }>('/api/user/export', {
    schema: {
      summary: 'Exporter toutes ses données (JSON ou CSV)',
      tags: ['user'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: { format: { type: 'string', enum: ['json', 'csv'], default: 'json' } },
      },
      response: { 401: errorSchema },
    },
    preHandler: fastify.authenticate,
  }, async (req, reply) => {
    const userId = req.user.userId

    const [user, categoryRows, transactionRows, recurringRows] = await Promise.all([
      fastify.prisma.user.findUnique({
        where:  { id: userId },
        select: { emailEncrypted: true, createdAt: true },
      }),
      fastify.prisma.category.findMany({ where: { userId }, orderBy: { position: 'asc' } }),
      fastify.prisma.transaction.findMany({ where: { userId }, orderBy: { date: 'desc' } }),
      fastify.prisma.recurringTransaction.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    ])

    if (!user) {
      return reply.code(401).send({ error: 'Utilisateur introuvable.', code: 'USER_NOT_FOUND' })
    }

    const categories: ExportedCategory[] = categoryRows.map((row) => ({
      id:       row.id,
      name:     decryptValue(row.nameEncrypted, CATEGORY_USAGE),
      color:    row.color,
      position: row.position,
      parentId: row.parentId ?? null,
    }))
    const categoryById = new Map(categories.map((c) => [c.id, c]))

    const transactions = transactionRows.map((row) => ({
      id:          row.id,
      date:        isoDay(row.date),
      type:        row.type,
      amount:      parseInt(decryptValue(row.amountEncrypted, AMOUNT_USAGE), 10),
      title:       decryptValue(row.titleEncrypted, TITLE_USAGE),
      note:        row.note,
      categoryId:  row.categoryId ?? null,
      recurringId: row.recurringId ?? null,
    }))

    reply.header('Cache-Control', 'no-store')

    if (req.query.format === 'csv') {
      const rows = transactions.map((t) => {
        const category = t.categoryId ? categoryById.get(t.categoryId) : null
        const parent   = category?.parentId ? categoryById.get(category.parentId) : null
        return [
          t.date,
          t.type,
          centsToDecimal(t.amount),
          t.title,
          parent ? parent.name : (category?.name ?? ''),
          parent ? category?.name : '',
          t.note,
        ]
      })

      return reply
        .header('Content-Type', 'text/csv; charset=utf-8')
        .send(toCsv(CSV_HEADERS, rows))
    }

    return reply.code(200).send({
      exportedAt: new Date().toISOString(),
      account: {
        email:     decryptEmail(user.emailEncrypted),
        createdAt: user.createdAt,
      },
      // Montants en centimes, comme dans l'API.
      categories,
      transactions,
      recurring: recurringRows.map((row) => ({
        id:         row.id,
        title:      decryptValue(row.titleEncrypted, TITLE_USAGE),
        amount:     parseInt(decryptValue(row.amountEncrypted, AMOUNT_USAGE), 10),
        type:       row.type,
        dayOfMonth: row.dayOfMonth,
        note:       row.note,
        active:     row.active,
        startDate:  isoDay(row.startDate),
        endDate:    row.endDate ? isoDay(row.endDate) : null,
        categoryId: row.categoryId ?? null,
      })),
    })
  })
}
