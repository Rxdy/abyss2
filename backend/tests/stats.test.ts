/**
 * Tests d'intégration — route /api/stats
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { buildApp } from '../src/app.js'

beforeAll(() => {
  process.env.MASTER_SECRET = 'b'.repeat(64)
  process.env.JWT_SECRET    = 'test-jwt-secret'
})

const { encryptValue } = await import('../src/utils/crypto.js')
const { CATEGORY_USAGE } = await import('../src/routes/categories.js')
const { AMOUNT_USAGE } = await import('../src/routes/transactions.js')

const USER_ID   = '11111111-1111-1111-1111-111111111111'
const FOOD_ID   = '22222222-2222-2222-2222-222222222222'
const RESTO_ID  = '33333333-3333-3333-3333-333333333333' // sous-catégorie de FOOD
const TRANSPORT_ID = '44444444-4444-4444-4444-444444444444'

function catRow(id: string, name: string, color: string, parentId: string | null = null) {
  return { id, userId: USER_ID, parentId, nameEncrypted: encryptValue(name, CATEGORY_USAGE), color }
}

function txRow(amount: number, categoryId: string | null, type = 'expense') {
  return { amountEncrypted: encryptValue(String(amount), AMOUNT_USAGE), categoryId, type }
}

let app: any
let mockPrisma: any
let token: string

beforeEach(async () => {
  mockPrisma = {
    user:     { findUnique: vi.fn() },
    category: { findMany: vi.fn().mockResolvedValue([]) },
    transaction: { findMany: vi.fn().mockResolvedValue([]) },
    recurringTransaction: { findMany: vi.fn().mockResolvedValue([]) },
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
const get = (qs: string) => app.inject({ method: 'GET', url: `/api/stats${qs}`, headers: auth() })

describe('GET /api/stats', () => {
  it('401 sans token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/stats?from=2026-01-01&to=2026-01-31' })
    expect(res.statusCode).toBe(401)
  })

  it('400 — période invalide (fin avant début)', async () => {
    const res = await get('?from=2026-02-01&to=2026-01-01')
    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('END_BEFORE_START')
  })

  it('calcule le pourcentage de chaque catégorie sur le total', async () => {
    mockPrisma.category.findMany.mockResolvedValue([
      catRow(FOOD_ID, 'Alimentation', '#4ade80'),
      catRow(TRANSPORT_ID, 'Transport', '#4f8ef7'),
    ])
    mockPrisma.transaction.findMany.mockResolvedValue([
      txRow(7000, FOOD_ID),
      txRow(3000, TRANSPORT_ID),
    ])

    const res = await get('?from=2026-01-01&to=2026-01-31')

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total).toBe(10000)
    expect(body.categories).toEqual([
      { id: FOOD_ID, name: 'Alimentation', color: '#4ade80', amount: 7000, percentage: 70, children: [] },
      { id: TRANSPORT_ID, name: 'Transport', color: '#4f8ef7', amount: 3000, percentage: 30, children: [] },
    ])
  })

  it('additionne les sous-catégories dans le total de leur parente', async () => {
    mockPrisma.category.findMany.mockResolvedValue([
      catRow(FOOD_ID, 'Alimentation', '#4ade80'),
      catRow(RESTO_ID, 'Restaurant', '#facc15', FOOD_ID),
    ])
    mockPrisma.transaction.findMany.mockResolvedValue([
      txRow(6000, FOOD_ID),
      txRow(4000, RESTO_ID),
    ])

    const res = await get('?from=2026-01-01&to=2026-01-31')

    const [alimentation] = res.json().categories
    expect(alimentation.amount).toBe(10000)
    expect(alimentation.percentage).toBe(100)
    expect(alimentation.children).toEqual([
      { id: RESTO_ID, name: 'Restaurant', color: '#facc15', amount: 4000, percentage: 40 },
    ])
  })

  it('regroupe les transactions sans catégorie sous "Sans catégorie"', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([txRow(5000, null)])

    const res = await get('?from=2026-01-01&to=2026-01-31')

    expect(res.json().categories).toEqual([
      { id: null, name: 'Sans catégorie', color: null, amount: 5000, percentage: 100, children: [] },
    ])
  })

  it('filtre par type (expense par défaut, income explicite)', async () => {
    await get('?from=2026-01-01&to=2026-01-31&type=income')

    expect(mockPrisma.transaction.findMany.mock.calls[0][0].where.type).toBe('income')
  })

  it('total à 0 si aucune transaction sur la période', async () => {
    const res = await get('?from=2026-01-01&to=2026-01-31')

    expect(res.json()).toMatchObject({ total: 0, categories: [] })
  })
})
