import crypto from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { decryptEmail } from '../utils/crypto.js'
import { sendSupportEmail, supportRecipient, type SupportKind } from '../utils/mail.js'
import { codeBlock, codeCell, createGithubIssue, githubIssuesConfigured, type CreatedIssue } from '../utils/github.js'
import { rateLimitError } from '../utils/rate-limit.js'

const errorSchema = {
  type: 'object',
  properties: { error: { type: 'string' }, code: { type: 'string' } },
}

/** 5 tickets par heure et par compte : assez pour signaler plusieurs soucis d'affilée, pas pour inonder la boîte. */
const SUPPORT_LIMIT = { max: 5, timeWindow: '1 hour' }

export const SUBJECT_MAX = 120
export const MESSAGE_MAX = 5000

interface SupportBody {
  kind:     SupportKind
  subject:  string
  message:  string
  context?: Record<string, string>
}

/** Seuls les bugs et les améliorations deviennent des issues : une « autre demande » concerne un compte, pas le code. */
const ISSUE_LABELS: Partial<Record<SupportKind, string>> = { bug: 'bug', idea: 'enhancement' }
const ISSUE_PREFIX: Partial<Record<SupportKind, string>> = { bug: 'Bug', idea: 'Amélioration' }

/**
 * Corps de l'issue (dépôt public) : jamais l'email ni l'identifiant du compte, seulement ce que la
 * personne a écrit — dans un bloc de code — et les mesures de son appareil.
 */
function issueBody(reference: string, kind: SupportKind, subject: string, message: string, context: Record<string, string>) {
  const rows = Object.entries(context).map(([key, value]) => `| ${key} | ${codeCell(value)} |`)
  return [
    `**${ISSUE_PREFIX[kind]}** signalé depuis l'app (Profil → Support) · référence \`${reference}\``,
    '',
    'Publié sans nom ni email : l\'auteur est joignable par le mail du support portant cette référence.',
    '',
    '### Message',
    codeBlock(`${subject}\n\n${message}`),
    ...(rows.length ? ['', '### Appareil', '', '| | |', '|---|---|', ...rows] : []),
  ].join('\n')
}

/** Référence courte et lisible (ex. AB-7F3K2Q), pour retrouver le ticket dans la boîte mail. */
function newReference() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sans 0/O ni 1/I, souvent confondus
  const bytes = crypto.randomBytes(6)
  return 'AB-' + Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

export default async function supportRoutes(fastify: FastifyInstance) {
  const supportByAccount = fastify.createRateLimit({
    ...SUPPORT_LIMIT,
    keyGenerator: (req: FastifyRequest) => `support:${req.user.userId}`,
  })

  async function enforceLimit(req: FastifyRequest, reply: FastifyReply) {
    const limit = await supportByAccount(req)
    if (!limit.isAllowed && limit.isExceeded) {
      reply.header('retry-after', limit.ttlInSeconds)
      throw rateLimitError(limit.ttl)
    }
  }

  // ── POST /api/support ───────────────────────────────────
  // Bug, amélioration ou autre demande, envoyé par email (voir supportRecipient). Un bug ou une
  // amélioration devient aussi une issue GitHub anonymisée, quand le jeton est configuré. Rien n'est stocké en base : la boîte
  // mail sert de file de tickets, et y répondre répond directement à l'utilisateur (Reply-To).
  fastify.post<{ Body: SupportBody }>('/api/support', {
    schema: {
      summary: 'Envoyer un ticket de support (bug ou amélioration)',
      tags: ['support'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['kind', 'subject', 'message'],
        properties: {
          kind:    { type: 'string', enum: ['bug', 'idea', 'other'] },
          subject: { type: 'string', minLength: 3, maxLength: SUBJECT_MAX, pattern: '\\S' },
          message: { type: 'string', minLength: 10, maxLength: MESSAGE_MAX, pattern: '\\S' },
          context: {
            type: 'object',
            description: 'Appareil, écran, version… — joint au mail pour reproduire un bug',
            maxProperties: 10,
            additionalProperties: { type: 'string', maxLength: 300 },
          },
        },
      },
      response: {
        201: { type: 'object', properties: { reference: { type: 'string' } } },
        400: errorSchema,
        401: errorSchema,
        429: errorSchema,
        502: errorSchema,
        503: errorSchema,
      },
    },
    preHandler: [fastify.authenticate, fastify.csrfIfCookie, enforceLimit],
  }, async (req, reply) => {
    const to = supportRecipient()
    if (!to) {
      fastify.log.error('Ni SUPPORT_EMAIL ni SMTP_USER : ticket de support impossible à envoyer')
      return reply.code(503).send({ error: 'Le support n\'est pas disponible pour le moment.', code: 'SUPPORT_NOT_CONFIGURED' })
    }

    const user = await fastify.prisma.user.findUnique({
      where:  { id: req.user.userId },
      select: { emailEncrypted: true, createdAt: true },
    })
    if (!user) return reply.code(401).send({ error: 'Utilisateur introuvable.', code: 'USER_NOT_FOUND' })

    const reference = newReference()
    const { kind } = req.body
    const subject = req.body.subject.trim()
    const message = req.body.message.trim()

    // L'issue d'abord, pour mettre son lien dans le mail. Un échec côté GitHub ne bloque pas le ticket.
    let issue: CreatedIssue | undefined
    const label = ISSUE_LABELS[kind]
    if (label && githubIssuesConfigured()) {
      try {
        issue = await createGithubIssue({
          title:  `[${ISSUE_PREFIX[kind]}] ${subject}`,
          body:   issueBody(reference, kind, subject, message, req.body.context ?? {}),
          labels: [label],
        })
      } catch (err) {
        fastify.log.error(err, 'Échec de la création de l\'issue GitHub du ticket de support')
      }
    }

    try {
      await sendSupportEmail(to, {
        reference,
        kind,
        subject,
        message,
        issue,
        userEmail: decryptEmail(user.emailEncrypted),
        context: {
          ...req.body.context,
          'Compte': req.user.userId,
          'Compte créé le': user.createdAt.toISOString().slice(0, 10),
          'Envoyé le': new Date().toISOString(),
        },
      })
    } catch (err) {
      fastify.log.error(err, 'Échec de l\'envoi du ticket de support')
      // Déjà enregistré sur GitHub : le ticket n'est pas perdu, on ne demande pas de le renvoyer.
      if (issue) return reply.code(201).send({ reference })
      // Sinon, contrairement au mot de passe oublié, l'utilisateur doit savoir que rien n'est parti.
      return reply.code(502).send({ error: 'Le message n\'a pas pu être envoyé. Réessayez dans quelques minutes.', code: 'SUPPORT_SEND_FAILED' })
    }

    return reply.code(201).send({ reference })
  })
}
