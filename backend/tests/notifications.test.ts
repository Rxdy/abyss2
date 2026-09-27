/**
 * Tests d'intégration — routes /api/notifications
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { buildApp } from '../src/app.js'

beforeAll(() => {
  process.env.MASTER_SECRET = 'b'.repeat(64)
  process.env.JWT_SECRET    = 'test-jwt-secret'
})

const { encryptValue } = await import('../src/utils/crypto.js')
const { ENVELOPE_NAME_USAGE, ENVELOPE_BUDGET_USAGE } = await import('../src/routes/envelopes.js')
const { AMOUNT_USAGE } = await import('../src/routes/transactions.js')

const CAT_ID = '22222222-2222-2222-2222-222222222222'
const expenseRow = (cents: number) => ({ amountEncrypted: encryptValue(String(cents), AMOUNT_USAGE) })

const USER_ID = '11111111-1111-1111-1111-111111111111'
const NOTIF_ID = '66666666-6666-6666-6666-666666666666'
const ENV_ID   = '55555555-5555-5555-5555-555555555555'

function overspendRow(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTIF_ID,
    userId: USER_ID,
    type: 'envelope_overspend',
    envelopeId: ENV_ID,
    count: null,
    read: false,
    archived: false,
    createdAt: new Date('2026-09-20T10:00:00Z'),
    envelope: {
      nameEncrypted:   encryptValue('Vie quotidienne', ENVELOPE_NAME_USAGE),
      budgetEncrypted: encryptValue('40000', ENVELOPE_BUDGET_USAGE),
      categories:      [{ id: CAT_ID }],
    },
    ...overrides,
  }
}

function digestRow(count: number, overrides: Record<string, unknown> = {}) {
  return {
    id: NOTIF_ID,
    userId: USER_ID,
    type: 'uncategorized_digest',
    envelopeId: null,
    count,
    read: false,
    archived: false,
    createdAt: new Date('2026-09-20T10:00:00Z'),
    envelope: null,
    ...overrides,
  }
}

let app: any
let mockPrisma: any
let token: string

beforeEach(async () => {
  mockPrisma = {
    user:         {
      findUnique: vi.fn().mockResolvedValue({ tokenVersion: 0, lastUncategorizedDigestAt: null, notifyUncategorizedDigest: true }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    notification: {
      findMany:   vi.fn().mockResolvedValue([]),
      findFirst:  vi.fn(),
      count:      vi.fn().mockResolvedValue(0),
      update:     vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      delete:     vi.fn(),
      create:     vi.fn(),
    },
    transaction: {
      count:    vi.fn().mockResolvedValue(0),
      // Dépenses du mois de l'enveloppe : 432,10 € pour un plafond de 400 €.
      findMany: vi.fn().mockResolvedValue([expenseRow(40000), expenseRow(3210)]),
    },
    $disconnect: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([]),
  }
  app = await buildApp({ testing: true, prisma: mockPrisma })
  await app.ready()
  token = app.jwt.sign({ userId: USER_ID, email: 'alice@example.com', tv: 0 })
})

afterEach(async () => {
  if (app) await app.close()
})

const auth = () => ({ authorization: `Bearer ${token}` })

describe('GET /api/notifications', () => {
  it('401 sans token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/notifications' })
    expect(res.statusCode).toBe(401)
  })

  it('200 — reconstruit le titre et le message d\'une enveloppe dépassée', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([overspendRow()])

    const res = await app.inject({ method: 'GET', url: '/api/notifications', headers: auth() })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([{
      id: NOTIF_ID, type: 'envelope_overspend',
      title: 'Enveloppe dépassée',
      message: '« Vie quotidienne » : 432,10\u00a0€ dépensés en septembre 2026, pour un plafond de 400,00\u00a0€.',
      envelopeId: ENV_ID, count: null, read: false, archived: false,
      createdAt: '2026-09-20T10:00:00.000Z',
    }])
  })

  it('dépenses du mois du dépassement : lit l\'enveloppe et le mois de création, pas le mois courant', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([overspendRow()])

    await app.inject({ method: 'GET', url: '/api/notifications', headers: auth() })

    expect(mockPrisma.transaction.findMany.mock.calls[0][0].where).toEqual({
      userId: USER_ID, type: 'expense', categoryId: { in: [CAT_ID] },
      date: { gte: new Date('2026-09-01T00:00:00Z'), lte: new Date('2026-09-30T00:00:00Z') },
    })
  })

  it('montants dans la devise choisie par l\'utilisateur', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([overspendRow()])
    mockPrisma.user.findUnique.mockResolvedValue({ tokenVersion: 0, notifyUncategorizedDigest: false, currency: 'CHF' })

    const res = await app.inject({ method: 'GET', url: '/api/notifications', headers: auth() })

    expect(res.json()[0].message).toContain('CHF')
    expect(res.json()[0].message).not.toContain('€')
  })

  it('revenue sous le plafond depuis : le message le dit au lieu de se contredire', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([overspendRow()])
    mockPrisma.transaction.findMany.mockResolvedValue([expenseRow(38000)])

    const res = await app.inject({ method: 'GET', url: '/api/notifications', headers: auth() })

    expect(res.json()[0].message).toBe(
      '« Vie quotidienne » a dépassé son plafond en septembre 2026, mais est depuis revenue à 380,00\u00a0€ sur 400,00\u00a0€.',
    )
  })

  it('plusieurs dépassements de la même enveloppe le même mois : une seule lecture des dépenses', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([overspendRow(), overspendRow({ id: '77777777-7777-7777-7777-777777777777' })])

    await app.inject({ method: 'GET', url: '/api/notifications', headers: auth() })

    expect(mockPrisma.transaction.findMany).toHaveBeenCalledTimes(1)
  })

  it('200 — message générique si l\'enveloppe a depuis été supprimée', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([overspendRow({ envelopeId: null, envelope: null })])

    const res = await app.inject({ method: 'GET', url: '/api/notifications', headers: auth() })

    expect(res.json()[0].message).toBe('Une enveloppe a dépassé son plafond mensuel.')
  })

  it('200 — reconstruit le titre et le message d\'un solde négatif', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([overspendRow({ type: 'negative_balance', envelopeId: null, envelope: null })])

    const res = await app.inject({ method: 'GET', url: '/api/notifications', headers: auth() })

    expect(res.json()[0]).toMatchObject({
      type: 'negative_balance', title: 'Solde négatif', message: 'Votre solde est passé sous zéro.',
    })
  })

  it.each([1, 18])('200 — pluralise le digest correctement (%i)', async (count) => {
    mockPrisma.notification.findMany.mockResolvedValue([digestRow(count)])
    mockPrisma.transaction.count.mockResolvedValue(count)

    const res = await app.inject({ method: 'GET', url: '/api/notifications', headers: auth() })

    const { title, message } = res.json()[0]
    expect(title).toBe('Dépenses non catégorisées')
    expect(message).toBe(
      count > 1
        ? `${count} dépenses ne sont rattachées à aucune catégorie.`
        : `${count} dépense n'est rattachée à aucune catégorie.`,
    )
  })

  it('ne renvoie que les notifications non archivées par défaut', async () => {
    await app.inject({ method: 'GET', url: '/api/notifications', headers: auth() })

    expect(mockPrisma.notification.findMany.mock.calls[0][0].where)
      .toEqual({ userId: USER_ID, archived: false })
  })

  it('?archived=true renvoie les archivées', async () => {
    await app.inject({ method: 'GET', url: '/api/notifications?archived=true', headers: auth() })

    expect(mockPrisma.notification.findMany.mock.calls[0][0].where)
      .toEqual({ userId: USER_ID, archived: true })
  })

  it('vérifie le digest hebdomadaire avant de renvoyer la liste', async () => {
    await app.inject({ method: 'GET', url: '/api/notifications', headers: auth() })

    expect(mockPrisma.transaction.count).toHaveBeenCalled() // maybeCreateUncategorizedDigest
  })
})

describe('GET /api/notifications — digest à jour', () => {
  it('compte les dépenses non catégorisées au moment de la lecture, pas à la création', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([digestRow(12)])
    mockPrisma.transaction.count.mockResolvedValue(3)

    const res = await app.inject({ method: 'GET', url: '/api/notifications', headers: auth() })

    expect(res.json()[0]).toMatchObject({ count: 3, message: '3 dépenses ne sont rattachées à aucune catégorie.' })
  })

  it('toutes catégorisées depuis : le dit', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([digestRow(12)])
    mockPrisma.transaction.count.mockResolvedValue(0)

    const res = await app.inject({ method: 'GET', url: '/api/notifications', headers: auth() })

    expect(res.json()[0]).toMatchObject({ count: 0, message: 'Toutes vos dépenses sont désormais rattachées à une catégorie.' })
  })
})

describe('POST /api/notifications/read-all', () => {
  it('401 sans token', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/notifications/read-all' })
    expect(res.statusCode).toBe(401)
  })

  it('200 — passe en lues les non lues actives de l\'utilisateur, et seulement elles', async () => {
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 4 })

    const res = await app.inject({ method: 'POST', url: '/api/notifications/read-all', headers: auth() })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ updated: 4 })
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, read: false, archived: false },
      data:  { read: true },
    })
  })
})

describe('GET /api/notifications/unread-count', () => {
  it('401 sans token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/notifications/unread-count' })
    expect(res.statusCode).toBe(401)
  })

  it('200 — compte les non lues, non archivées', async () => {
    mockPrisma.notification.count.mockResolvedValue(3)

    const res = await app.inject({ method: 'GET', url: '/api/notifications/unread-count', headers: auth() })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ count: 3 })
    expect(mockPrisma.notification.count.mock.calls[0][0].where)
      .toEqual({ userId: USER_ID, read: false, archived: false })
  })
})

describe('PUT /api/notifications/:id', () => {
  it('200 — marque lue', async () => {
    mockPrisma.notification.findFirst.mockResolvedValue({ id: NOTIF_ID })
    mockPrisma.notification.update.mockResolvedValue(overspendRow({ read: true }))

    const res = await app.inject({
      method: 'PUT', url: `/api/notifications/${NOTIF_ID}`, headers: auth(), payload: { read: true },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().read).toBe(true)
    expect(mockPrisma.notification.update.mock.calls[0][0].data).toEqual({ read: true })
  })

  it('200 — archive', async () => {
    mockPrisma.notification.findFirst.mockResolvedValue({ id: NOTIF_ID })
    mockPrisma.notification.update.mockResolvedValue(overspendRow({ archived: true }))

    const res = await app.inject({
      method: 'PUT', url: `/api/notifications/${NOTIF_ID}`, headers: auth(), payload: { archived: true },
    })

    expect(res.json().archived).toBe(true)
  })

  it('404 — notification d\'un autre utilisateur', async () => {
    mockPrisma.notification.findFirst.mockResolvedValue(null)

    const res = await app.inject({
      method: 'PUT', url: `/api/notifications/${NOTIF_ID}`, headers: auth(), payload: { read: true },
    })

    expect(res.statusCode).toBe(404)
    expect(mockPrisma.notification.update).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/notifications/:id', () => {
  it('200 — supprime', async () => {
    mockPrisma.notification.findFirst.mockResolvedValue({ id: NOTIF_ID })
    mockPrisma.notification.delete.mockResolvedValue({ id: NOTIF_ID })

    const res = await app.inject({ method: 'DELETE', url: `/api/notifications/${NOTIF_ID}`, headers: auth() })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ id: NOTIF_ID, deleted: true })
  })

  it('404 — notification d\'un autre utilisateur', async () => {
    mockPrisma.notification.findFirst.mockResolvedValue(null)

    const res = await app.inject({ method: 'DELETE', url: `/api/notifications/${NOTIF_ID}`, headers: auth() })

    expect(res.statusCode).toBe(404)
    expect(mockPrisma.notification.delete).not.toHaveBeenCalled()
  })
})
