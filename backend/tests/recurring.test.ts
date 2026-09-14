/**
 * Tests d'intégration — routes /api/recurring
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { buildApp } from '../src/app.js'

beforeAll(() => {
  process.env.MASTER_SECRET = 'b'.repeat(64)
  process.env.JWT_SECRET    = 'test-jwt-secret'
})

const { encryptValue, decryptValue } = await import('../src/utils/crypto.js')
const { CATEGORY_USAGE } = await import('../src/routes/categories.js')
const { TITLE_USAGE, AMOUNT_USAGE } = await import('../src/routes/transactions.js')

const USER_ID = '11111111-1111-1111-1111-111111111111'
const REC_ID  = '55555555-5555-5555-5555-555555555555'
const CAT_ID  = '22222222-2222-2222-2222-222222222222'

function recurringRow(overrides: Record<string, unknown> = {}) {
  return {
    id: REC_ID,
    userId: USER_ID,
    categoryId: null,
    titleEncrypted:  encryptValue('Loyer', TITLE_USAGE),
    amountEncrypted: encryptValue('75000', AMOUNT_USAGE),
    type: 'expense',
    dayOfMonth: 1,
    note: null,
    active: true,
    startDate: new Date('2026-01-01'),
    endDate: null,
    lastGeneratedMonth: null,
    category: null,
    ...overrides,
  }
}

let app: any
let mockPrisma: any
let token: string

beforeEach(async () => {
  mockPrisma = {
    user:     { findUnique: vi.fn() },
    category: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    transaction: {
      findMany: vi.fn().mockResolvedValue([]),
      create:   vi.fn(),
    },
    recurringTransaction: {
      findMany:  vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      create:    vi.fn(),
      update:    vi.fn(),
      delete:    vi.fn(),
    },
    $disconnect: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([]),
    $transaction: vi.fn((fn: any) => fn(mockPrisma)),
  }
  app = await buildApp({ testing: true, prisma: mockPrisma })
  await app.ready()
  token = app.jwt.sign({ userId: USER_ID, email: 'alice@example.com' })
})

afterEach(async () => {
  if (app) await app.close()
})

const auth = () => ({ authorization: `Bearer ${token}` })

describe('GET /api/recurring', () => {
  it('401 sans token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/recurring' })
    expect(res.statusCode).toBe(401)
  })

  it('200 — déchiffre le libellé et le montant, calcule nextDate', async () => {
    mockPrisma.recurringTransaction.findMany.mockResolvedValue([recurringRow()])

    const res = await app.inject({ method: 'GET', url: '/api/recurring', headers: auth() })

    expect(res.statusCode).toBe(200)
    const [item] = res.json()
    expect(item.title).toBe('Loyer')
    expect(item.amount).toBe(75000)
    expect(item.dayOfMonth).toBe(1)
    expect(item.nextDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('ne renvoie que les modèles de l\'utilisateur du token', async () => {
    await app.inject({ method: 'GET', url: '/api/recurring', headers: auth() })

    // calls[0] est l'appel fait par runDueRecurring (where: { userId, active: true }) ;
    // calls[1] est celui de la route elle-même, pour lister.
    expect(mockPrisma.recurringTransaction.findMany.mock.calls[1][0].where).toEqual({ userId: USER_ID })
  })

  it('lance le rattrapage des transactions dues avant de lister', async () => {
    await app.inject({ method: 'GET', url: '/api/recurring', headers: auth() })

    // runDueRecurring interroge d'abord les modèles actifs de l'utilisateur.
    expect(mockPrisma.recurringTransaction.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID, active: true } }),
    )
  })
})

describe('POST /api/recurring', () => {
  it('201 — chiffre le titre et le montant', async () => {
    mockPrisma.recurringTransaction.create.mockImplementation(async ({ data }: any) => ({ id: REC_ID, ...data, category: null }))
    // Le POST relit le modèle après coup (runDueRecurring a pu le faire évoluer) :
    // on renvoie la même forme, sans catégorie ici.
    mockPrisma.recurringTransaction.findFirst.mockResolvedValue(recurringRow())

    const res = await app.inject({
      method: 'POST', url: '/api/recurring', headers: auth(),
      payload: { title: 'Loyer', amount: 75000, dayOfMonth: 1, startDate: '2026-01-01' },
    })

    expect(res.statusCode).toBe(201)
    const { data } = mockPrisma.recurringTransaction.create.mock.calls[0][0]
    expect(data.titleEncrypted).not.toContain('Loyer')
    expect(decryptValue(data.titleEncrypted, TITLE_USAGE)).toBe('Loyer')
    expect(decryptValue(data.amountEncrypted, AMOUNT_USAGE)).toBe('75000')
    expect(data.userId).toBe(USER_ID)
  })

  it('400 — dayOfMonth hors bornes', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/recurring', headers: auth(),
      payload: { title: 'Loyer', amount: 75000, dayOfMonth: 32 },
    })
    expect(res.statusCode).toBe(400)
    expect(mockPrisma.recurringTransaction.create).not.toHaveBeenCalled()
  })

  it('400 — catégorie d\'un autre utilisateur', async () => {
    mockPrisma.category.findFirst.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST', url: '/api/recurring', headers: auth(),
      payload: { title: 'Loyer', amount: 75000, dayOfMonth: 1, categoryId: CAT_ID },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('CATEGORY_NOT_FOUND')
  })

  it('400 — date de fin avant la date de début', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/recurring', headers: auth(),
      payload: { title: 'Loyer', amount: 75000, dayOfMonth: 1, startDate: '2026-06-01', endDate: '2026-01-01' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('END_BEFORE_START')
    expect(mockPrisma.recurringTransaction.create).not.toHaveBeenCalled()
  })

  it('401 sans token', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/recurring', payload: { title: 'Loyer', amount: 75000, dayOfMonth: 1 },
    })
    expect(res.statusCode).toBe(401)
    expect(mockPrisma.recurringTransaction.create).not.toHaveBeenCalled()
  })
})

describe('PUT /api/recurring/:id', () => {
  it('200 — met en pause (active:false)', async () => {
    mockPrisma.recurringTransaction.findFirst
      .mockResolvedValueOnce(recurringRow())
      .mockResolvedValueOnce(recurringRow({ active: false }))
    mockPrisma.recurringTransaction.update.mockResolvedValue(recurringRow({ active: false }))

    const res = await app.inject({
      method: 'PUT', url: `/api/recurring/${REC_ID}`, headers: auth(),
      payload: { active: false },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().active).toBe(false)
    expect(mockPrisma.recurringTransaction.update.mock.calls[0][0].data).toEqual({ active: false })
  })

  it('404 — modèle d\'un autre utilisateur', async () => {
    mockPrisma.recurringTransaction.findFirst.mockResolvedValue(null)

    const res = await app.inject({
      method: 'PUT', url: `/api/recurring/${REC_ID}`, headers: auth(), payload: { active: false },
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().code).toBe('RECURRING_NOT_FOUND')
    expect(mockPrisma.recurringTransaction.update).not.toHaveBeenCalled()
  })

  it('400 — nouvelle date de fin avant la date de début existante', async () => {
    mockPrisma.recurringTransaction.findFirst.mockResolvedValue(recurringRow())

    const res = await app.inject({
      method: 'PUT', url: `/api/recurring/${REC_ID}`, headers: auth(),
      payload: { endDate: '2025-01-01' },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('END_BEFORE_START')
  })
})

describe('DELETE /api/recurring/:id', () => {
  it('200 — supprime le modèle (les transactions déjà générées restent, recurringId → NULL en base)', async () => {
    mockPrisma.recurringTransaction.findFirst.mockResolvedValue({ id: REC_ID })
    mockPrisma.recurringTransaction.delete.mockResolvedValue({ id: REC_ID })

    const res = await app.inject({ method: 'DELETE', url: `/api/recurring/${REC_ID}`, headers: auth() })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ id: REC_ID, deleted: true })
  })

  it('404 — modèle d\'un autre utilisateur', async () => {
    mockPrisma.recurringTransaction.findFirst.mockResolvedValue(null)

    const res = await app.inject({ method: 'DELETE', url: `/api/recurring/${REC_ID}`, headers: auth() })

    expect(res.statusCode).toBe(404)
    expect(mockPrisma.recurringTransaction.delete).not.toHaveBeenCalled()
  })
})
