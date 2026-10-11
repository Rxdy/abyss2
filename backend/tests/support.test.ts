/**
 * Tests d'intégration — POST /api/support (tickets envoyés par email)
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'

const sendSupportEmail = vi.fn().mockResolvedValue(undefined)
// Seul l'envoi est simulé : le choix du destinataire (supportRecipient) reste le vrai code.
vi.mock('../src/utils/mail.js', async (importOriginal) => ({ ...(await importOriginal<object>()), sendSupportEmail }))

const createGithubIssue = vi.fn()
// Seule la requête à GitHub est simulée : le format de l'issue (codeBlock…) reste le vrai code.
vi.mock('../src/utils/github.js', async (importOriginal) => ({ ...(await importOriginal<object>()), createGithubIssue }))

import { buildApp } from '../src/app.js'

beforeAll(() => {
  process.env.MASTER_SECRET = 'b'.repeat(64)
  process.env.JWT_SECRET    = 'test-jwt-secret'
})

const { encryptEmail } = await import('../src/utils/crypto.js')

let app: any
let mockPrisma: any
let token: string

beforeEach(async () => {
  process.env.SUPPORT_EMAIL = 'support@example.com'
  process.env.SMTP_USER = ''
  process.env.SMTP_HOST = 'smtp.gmail.com'
  sendSupportEmail.mockClear().mockResolvedValue(undefined)
  mockPrisma = {
    user: {
      // Sert à authenticate (tokenVersion) puis à la route (email, date de création)
      findUnique: vi.fn().mockResolvedValue({
        tokenVersion: 0,
        sessionMode: 'persistent',
        emailEncrypted: encryptEmail('alice@example.com'),
        createdAt: new Date('2026-10-11T08:00:00.000Z'),
      }),
    },
    $disconnect: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([]),
  }
  app = await buildApp({ testing: true, prisma: mockPrisma })
  await app.ready()
  token = app.jwt.sign({ userId: 'uuid-test-user', email: 'alice@example.com', tv: 0 })
})

afterEach(async () => {
  if (app) await app.close()
})

const ticket = {
  kind: 'bug',
  subject: 'La navbar flotte',
  message: 'Sur iPhone, une bande vide reste sous la barre du bas.',
  context: { Appareil: 'iPhone', 'App installée': 'oui' },
}

const send = (payload: unknown, headers: Record<string, string> = { authorization: `Bearer ${token}` }) =>
  app.inject({ method: 'POST', url: '/api/support', headers, payload })

describe('POST /api/support', () => {
  it('201 — envoie le ticket à SUPPORT_EMAIL et renvoie sa référence', async () => {
    const res = await send(ticket)

    expect(res.statusCode).toBe(201)
    expect(res.json().reference).toMatch(/^AB-[A-Z2-9]{6}$/)
    expect(sendSupportEmail).toHaveBeenCalledOnce()

    const [to, sent] = sendSupportEmail.mock.calls[0]
    expect(to).toBe('support@example.com')
    expect(sent).toMatchObject({
      reference: res.json().reference,
      kind: 'bug',
      subject: 'La navbar flotte',
      userEmail: 'alice@example.com',
    })
    expect(sent.context).toMatchObject({ Appareil: 'iPhone', 'Compte créé le': '2026-10-11' })
  })

  it('accepte une amélioration, sans contexte', async () => {
    const res = await send({ kind: 'idea', subject: 'Export PDF', message: 'Pouvoir exporter les stats en PDF.' })

    expect(res.statusCode).toBe(201)
    expect(sendSupportEmail.mock.calls[0][1].kind).toBe('idea')
  })

  it('401 — sans être connecté', async () => {
    const res = await send(ticket, {})

    expect(res.statusCode).toBe(401)
    expect(sendSupportEmail).not.toHaveBeenCalled()
  })

  it.each([
    ['type inconnu',         { ...ticket, kind: 'question' }],
    ['sujet trop court',     { ...ticket, subject: 'ab' }],
    ['message vide',         { ...ticket, message: '          ' }],
    ['message trop long',    { ...ticket, message: 'x'.repeat(5001) }],
  ])('400 — %s', async (_label, payload) => {
    const res = await send(payload)

    expect(res.statusCode).toBe(400)
    expect(sendSupportEmail).not.toHaveBeenCalled()
  })

  it('ignore un champ inattendu (retiré par la validation, comme partout dans l\'API)', async () => {
    const res = await send({ ...ticket, priority: 'haute' })

    expect(res.statusCode).toBe(201)
    expect(sendSupportEmail.mock.calls[0][1]).not.toHaveProperty('priority')
  })

  it('sans SUPPORT_EMAIL, écrit à l\'adresse d\'envoi (SMTP_USER) : elle s\'envoie le ticket à elle-même', async () => {
    process.env.SUPPORT_EMAIL = ''
    process.env.SMTP_USER = 'rudy@example.com'

    const res = await send(ticket)

    expect(res.statusCode).toBe(201)
    expect(sendSupportEmail.mock.calls[0][0]).toBe('rudy@example.com')
  })

  it('accepte une autre demande', async () => {
    const res = await send({ ...ticket, kind: 'other' })

    expect(res.statusCode).toBe(201)
    expect(sendSupportEmail.mock.calls[0][1].kind).toBe('other')
  })

  it('503 — quand aucun destinataire n\'est configuré', async () => {
    delete process.env.SUPPORT_EMAIL

    const res = await send(ticket)

    expect(res.statusCode).toBe(503)
    expect(res.json().code).toBe('SUPPORT_NOT_CONFIGURED')
  })

  it('502 — prévient l\'utilisateur quand l\'envoi échoue', async () => {
    sendSupportEmail.mockRejectedValueOnce(new Error('SMTP down'))

    const res = await send(ticket)

    expect(res.statusCode).toBe(502)
    expect(res.json().code).toBe('SUPPORT_SEND_FAILED')
  })

  it('429 — au-delà de 5 tickets par heure', async () => {
    for (let i = 0; i < 5; i++) expect((await send(ticket)).statusCode).toBe(201)

    const res = await send(ticket)

    expect(res.statusCode).toBe(429)
    expect(sendSupportEmail).toHaveBeenCalledTimes(5)
  })
})

describe('POST /api/support — issue GitHub', () => {
  beforeEach(() => {
    process.env.SUPPORT_GITHUB_TOKEN = 'github_pat_test'
    process.env.SUPPORT_GITHUB_REPO  = 'Rxdy/abyss2'
    createGithubIssue.mockReset().mockResolvedValue({ number: 42, url: 'https://github.com/Rxdy/abyss2/issues/42' })
  })

  afterEach(() => {
    delete process.env.SUPPORT_GITHUB_TOKEN
    delete process.env.SUPPORT_GITHUB_REPO
  })

  it('crée une issue « bug » anonymisée et met son lien dans le mail', async () => {
    const res = await send(ticket)

    expect(res.statusCode).toBe(201)
    const [issue] = createGithubIssue.mock.calls[0]
    expect(issue.title).toBe('[Bug] La navbar flotte')
    expect(issue.labels).toEqual(['bug'])
    expect(issue.body).toContain(ticket.message)
    expect(issue.body).toContain(res.json().reference)
    // Dépôt public : ni l'email, ni l'identifiant du compte
    expect(issue.body).not.toContain('alice@example.com')
    expect(issue.body).not.toContain('uuid-test-user')
    expect(sendSupportEmail.mock.calls[0][1].issue).toEqual({ number: 42, url: 'https://github.com/Rxdy/abyss2/issues/42' })
  })

  it('une amélioration reçoit le label « enhancement »', async () => {
    await send({ ...ticket, kind: 'idea' })

    expect(createGithubIssue.mock.calls[0][0]).toMatchObject({ title: '[Amélioration] La navbar flotte', labels: ['enhancement'] })
  })

  it('pas d\'issue pour une autre demande : elle concerne un compte, pas le code', async () => {
    await send({ ...ticket, kind: 'other' })

    expect(createGithubIssue).not.toHaveBeenCalled()
    expect(sendSupportEmail).toHaveBeenCalledOnce()
  })

  it('GitHub en panne : le ticket part quand même par mail, sans lien', async () => {
    createGithubIssue.mockRejectedValueOnce(new Error('GitHub down'))

    const res = await send(ticket)

    expect(res.statusCode).toBe(201)
    expect(sendSupportEmail.mock.calls[0][1].issue).toBeUndefined()
  })

  it('mail en échec mais issue créée : le ticket n\'est pas perdu, 201', async () => {
    sendSupportEmail.mockRejectedValueOnce(new Error('SMTP down'))

    const res = await send(ticket)

    expect(res.statusCode).toBe(201)
  })

  it('sans jeton GitHub, aucune issue', async () => {
    delete process.env.SUPPORT_GITHUB_TOKEN

    await send(ticket)

    expect(createGithubIssue).not.toHaveBeenCalled()
  })
})
