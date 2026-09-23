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
const { ENVELOPE_NAME_USAGE } = await import('../src/routes/envelopes.js')

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
    envelope: { nameEncrypted: encryptValue('Vie quotidienne', ENVELOPE_NAME_USAGE) },
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
    user:         { findUnique: vi.fn().mockResolvedValue({ tokenVersion: 0 }) },
    notification: {
      findMany:   vi.fn().mockResolvedValue([]),
      findFirst:  vi.fn(),
      count:      vi.fn().mockResolvedValue(0),
      update:     vi.fn(),
      delete:     vi.fn(),
      create:     vi.fn(),
    },
    transaction: { count: vi.fn().mockResolvedValue(0) },
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
      message: 'L\'enveloppe « Vie quotidienne » a dépassé son plafond mensuel.',
      envelopeId: ENV_ID, count: null, read: false, archived: false,
      createdAt: '2026-09-20T10:00:00.000Z',
    }])
  })

  it('200 — message générique si l\'enveloppe a depuis été supprimée', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([overspendRow({ envelopeId: null, envelope: null })])

    const res = await app.inject({ method: 'GET', url: '/api/notifications', headers: auth() })

    expect(res.json()[0].message).toBe('Une enveloppe a dépassé son plafond mensuel.')
  })

  it.each([1, 18])('200 — pluralise le digest correctement (%i)', async (count) => {
    mockPrisma.notification.findMany.mockResolvedValue([digestRow(count)])

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

    expect(mockPrisma.notification.findFirst).toHaveBeenCalled() // maybeCreateUncategorizedDigest
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
