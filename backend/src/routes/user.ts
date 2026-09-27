import bcrypt from 'bcryptjs'
import type { FastifyInstance } from 'fastify'
import { decryptEmail, decryptValue, encryptEmail, encryptValue, hashEmail } from '../utils/crypto.js'
import { CURRENCIES } from '../utils/currency.js'
import { centsToDecimal, toCsv } from '../utils/csv.js'
import { evaluatePassword, weakPasswordMessage } from '../utils/passwordStrength.js'
import { clearSession, issueSession, SESSION_MODES, type SessionMode } from '../utils/session.js'
import { BCRYPT_ROUNDS, DEFAULT_CATEGORIES, trimEmail } from './auth.js'
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

/** Réglages des notifications : clé d'API → colonne de User. */
const NOTIFICATION_SETTINGS = {
  envelopeOverspend:   'notifyEnvelopeOverspend',
  negativeBalance:     'notifyNegativeBalance',
  uncategorizedDigest: 'notifyUncategorizedDigest',
} as const

type NotificationSettingKey = keyof typeof NOTIFICATION_SETTINGS
type NotificationSettings = Record<NotificationSettingKey, boolean>

const notificationSettingsSchema = {
  type: 'object',
  properties: {
    envelopeOverspend:   { type: 'boolean', description: 'Enveloppe dépassée' },
    negativeBalance:     { type: 'boolean', description: 'Solde passé sous zéro' },
    uncategorizedDigest: { type: 'boolean', description: 'Rappel hebdomadaire des dépenses non catégorisées' },
  },
}

const NOTIFICATION_SELECT = { notifyEnvelopeOverspend: true, notifyNegativeBalance: true, notifyUncategorizedDigest: true } as const

function toSettings(user: Record<(typeof NOTIFICATION_SETTINGS)[NotificationSettingKey], boolean>): NotificationSettings {
  return {
    envelopeOverspend:   user.notifyEnvelopeOverspend,
    negativeBalance:     user.notifyNegativeBalance,
    uncategorizedDigest: user.notifyUncategorizedDigest,
  }
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
            currency:  { type: 'string', description: 'Devise d\'affichage choisie dans les Préférences' },
            sessionMode: { type: 'string', enum: ['persistent', 'strict'], description: 'Rester connecté, ou connexion à chaque session' },
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
      select: { id: true, emailEncrypted: true, createdAt: true, currency: true, sessionMode: true },
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
      currency:  user.currency,
      sessionMode: user.sessionMode,
      // Un appel de plus, mais GET /api/user tourne déjà à chaque démarrage de l'app (validation de
      // session) : c'est l'endroit naturel pour (re)donner un jeton CSRF après un rechargement de page.
      csrfToken: reply.generateCsrf(),
    })
  })

  // ── GET /api/user/notification-settings ─────────────────
  fastify.get('/api/user/notification-settings', {
    schema: {
      summary: 'Réglages des notifications (types activés)',
      tags: ['user'],
      security: [{ bearerAuth: [] }],
      response: { 200: notificationSettingsSchema, 401: errorSchema },
    },
    preHandler: fastify.authenticate,
  }, async (req, reply) => {
    const user = await fastify.prisma.user.findUnique({ where: { id: req.user.userId }, select: NOTIFICATION_SELECT })
    if (!user) return reply.code(401).send({ error: 'Utilisateur introuvable.', code: 'USER_NOT_FOUND' })

    return toSettings(user)
  })

  // ── PUT /api/user/notification-settings ─────────────────
  // Mise à jour partielle : seuls les types présents dans le corps changent. Couper un type arrête
  // sa génération (voir utils/notifications.ts) ; les notifications déjà reçues restent.
  fastify.put<{ Body: Partial<NotificationSettings> }>('/api/user/notification-settings', {
    schema: {
      summary: 'Activer ou couper des types de notification',
      tags: ['user'],
      security: [{ bearerAuth: [] }],
      body: { ...notificationSettingsSchema, additionalProperties: false, minProperties: 1 },
      response: { 200: notificationSettingsSchema, 400: errorSchema, 401: errorSchema },
    },
    preHandler: [fastify.authenticate, fastify.csrfIfCookie],
  }, async (req) => {
    const data: Partial<Record<(typeof NOTIFICATION_SETTINGS)[NotificationSettingKey], boolean>> = {}
    for (const [key, column] of Object.entries(NOTIFICATION_SETTINGS) as [NotificationSettingKey, (typeof NOTIFICATION_SETTINGS)[NotificationSettingKey]][]) {
      if (req.body[key] !== undefined) data[column] = req.body[key]
    }

    const user = await fastify.prisma.user.update({ where: { id: req.user.userId }, data, select: NOTIFICATION_SELECT })
    return toSettings(user)
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

  // ── DELETE /api/user/data ────────────────────────────────
  // Réinitialise le compte : transactions, charges fixes, catégories et
  // enveloppes supprimées, catégories par défaut ré-amorcées (comme à
  // l'inscription) — le compte et le mot de passe sont conservés. Le mot de
  // passe n'est pas redemandé : contrairement à la suppression du compte,
  // rien d'irrécupérable en dehors des données elles-mêmes n'est en jeu
  // (l'interface fait déjà saisir un mot de confirmation avant d'appeler
  // cette route).
  fastify.delete('/api/user/data', {
    schema: {
      summary: 'Réinitialiser les données du compte (catégories, transactions, charges fixes, enveloppes)',
      tags: ['user'],
      security: [{ bearerAuth: [] }],
      response: {
        200: { type: 'object', properties: { reset: { type: 'boolean' } } },
        401: errorSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.csrfIfCookie],
  }, async (req, reply) => {
    const userId = req.user.userId

    await fastify.prisma.$transaction([
      fastify.prisma.transaction.deleteMany({ where: { userId } }),
      fastify.prisma.recurringTransaction.deleteMany({ where: { userId } }),
      fastify.prisma.envelope.deleteMany({ where: { userId } }),
      fastify.prisma.category.deleteMany({ where: { userId } }),
      fastify.prisma.category.createMany({
        data: DEFAULT_CATEGORIES.map((category, position) => ({
          userId,
          nameEncrypted: encryptValue(category.name, CATEGORY_USAGE),
          color:         category.color,
          position,
        })),
      }),
    ])

    return reply.code(200).send({ reset: true })
  })

  // ── PUT /api/user/preferences ───────────────────────────
  // Préférences liées au compte (valables sur tous les appareils) — le thème, lui, reste propre à
  // chaque appareil (localStorage). Devise d'affichage, et mode de session (voir utils/session.ts) :
  // en changer ré-émet la session de cet appareil selon le nouveau mode ; passer en « connexion à
  // chaque session » déconnecte en plus les autres appareils, qui gardaient un cookie de 30 jours.
  fastify.put<{ Body: { currency?: string; sessionMode?: SessionMode } }>('/api/user/preferences', {
    schema: {
      summary: 'Changer ses préférences de compte (devise, mode de session)',
      tags: ['user'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          currency:    { type: 'string', enum: [...CURRENCIES] },
          sessionMode: { type: 'string', enum: [...SESSION_MODES] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            currency:    { type: 'string' },
            sessionMode: { type: 'string' },
            csrfToken:   { type: 'string', description: 'Présent si la session a été ré-émise (mode de session changé)' },
          },
        },
        400: errorSchema,
        401: errorSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.csrfIfCookie],
  }, async (req, reply) => {
    const { currency, sessionMode } = req.body

    const before = await fastify.prisma.user.findUnique({
      where:  { id: req.user.userId },
      select: { sessionMode: true, emailEncrypted: true },
    })
    if (!before) return reply.code(401).send({ error: 'Utilisateur introuvable.', code: 'USER_NOT_FOUND' })

    const modeChanged = sessionMode !== undefined && sessionMode !== before.sessionMode

    const user = await fastify.prisma.user.update({
      where:  { id: req.user.userId },
      data:   {
        ...(currency !== undefined && { currency }),
        ...(modeChanged && { sessionMode }),
        ...(modeChanged && sessionMode === 'strict' && { tokenVersion: { increment: 1 } }),
      },
      select: { id: true, currency: true, sessionMode: true, tokenVersion: true },
    })

    if (!modeChanged) return { currency: user.currency, sessionMode: user.sessionMode }

    const { csrfToken } = issueSession(fastify, reply, {
      id: user.id, email: decryptEmail(before.emailEncrypted), tokenVersion: user.tokenVersion, sessionMode: user.sessionMode,
    })
    return { currency: user.currency, sessionMode: user.sessionMode, csrfToken }
  })

  // ── PUT /api/user/email ─────────────────────────────────
  // Change l'adresse de connexion. Le mot de passe est redemandé (une session volée ne suffit pas à
  // détourner le compte), et comme pour le mot de passe, les autres appareils sont déconnectés : la
  // session de CET appareil est ré-émise avec le nouvel email.
  fastify.put<{ Body: { email: string; password: string } }>('/api/user/email', {
    preValidation: trimEmail,
    schema: {
      summary: 'Changer l\'adresse email du compte (déconnecte les autres appareils)',
      tags: ['user'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email:    { type: 'string', format: 'email', maxLength: 254 },
          password: { type: 'string' },
        },
      },
      response: {
        200: { type: 'object', properties: { email: { type: 'string' }, csrfToken: { type: 'string' } } },
        400: errorSchema,
        401: errorSchema,
        409: errorSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.csrfIfCookie],
  }, async (req, reply) => {
    const user = await fastify.prisma.user.findUnique({
      where:  { id: req.user.userId },
      select: { id: true, emailHash: true, passwordHash: true },
    })

    if (!user) {
      return reply.code(401).send({ error: 'Utilisateur introuvable.', code: 'USER_NOT_FOUND' })
    }

    if (!(await bcrypt.compare(req.body.password, user.passwordHash))) {
      return reply.code(401).send({ error: 'Mot de passe incorrect.', code: 'INVALID_CREDENTIALS' })
    }

    const cleanEmail = req.body.email.toLowerCase().trim()
    const emailHash  = hashEmail(cleanEmail)

    if (emailHash === user.emailHash) {
      return reply.code(400).send({ error: 'C\'est déjà l\'adresse de ce compte.', code: 'SAME_EMAIL' })
    }

    const taken = { error: 'Cette adresse email est déjà utilisée.', code: 'EMAIL_ALREADY_EXISTS' }
    if (await fastify.prisma.user.findUnique({ where: { emailHash }, select: { id: true } })) {
      return reply.code(409).send(taken)
    }

    let updated
    try {
      updated = await fastify.prisma.user.update({
        where:  { id: user.id },
        data:   { emailHash, emailEncrypted: encryptEmail(cleanEmail), tokenVersion: { increment: 1 } },
        select: { tokenVersion: true, sessionMode: true },
      })
    } catch (err) {
      // Deux comptes qui visent la même adresse au même moment : l'index unique tranche.
      if (err instanceof Error && (err as { code?: string }).code === 'P2002') return reply.code(409).send(taken)
      throw err
    }

    const { csrfToken } = issueSession(fastify, reply, {
      id: user.id, email: cleanEmail, tokenVersion: updated.tokenVersion, sessionMode: updated.sessionMode,
    })

    return reply.code(200).send({ email: cleanEmail, csrfToken })
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
      select: { tokenVersion: true, sessionMode: true },
    })

    // Ré-émet la session pour CET appareil (nouveau tokenVersion) : il reste connecté, les autres
    // (qui présentent l'ancien) seront rejetés par `authenticate` à leur prochaine requête.
    const { csrfToken } = issueSession(fastify, reply, {
      id: user.id,
      email: decryptEmail(user.emailEncrypted),
      tokenVersion: updated.tokenVersion,
      sessionMode: updated.sessionMode,
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
        select: { emailEncrypted: true, createdAt: true, currency: true },
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
        currency:  user.currency,
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
