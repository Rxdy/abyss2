/**
 * Tests d'intégration — routes /api/transactions et /api/summary
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
const TX_ID   = '33333333-3333-3333-3333-333333333333'
const CAT_ID  = '22222222-2222-2222-2222-222222222222'

/** Ligne telle que Prisma la renverrait. */
function txRow(
  { title = 'Carrefour', amount = 4250, date = '2026-09-05', type = 'expense', category = null as any, id = TX_ID } = {}
) {
  return {
    id,
    userId: USER_ID,
    titleEncrypted:  encryptValue(title, TITLE_USAGE),
    amountEncrypted: encryptValue(String(amount), AMOUNT_USAGE),
    date: new Date(date),
    type,
    note: null,
    category,
  }
}

function catRow(name = 'Courses') {
  return { id: CAT_ID, nameEncrypted: encryptValue(name, CATEGORY_USAGE), color: '#4ade80' }
}

let app: any
let mockPrisma: any
let token: string

beforeEach(async () => {
  mockPrisma = {
    user:     { findUnique: vi.fn() },
    category: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    transaction: {
      findMany:  vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      count:     vi.fn().mockResolvedValue(0),
      create:    vi.fn(),
      update:    vi.fn(),
      delete:    vi.fn(),
    },
    recurringTransaction: {
      findMany: vi.fn().mockResolvedValue([]),
      update:   vi.fn(),
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

describe('GET /api/transactions', () => {
  it('401 sans token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/transactions' })
    expect(res.statusCode).toBe(401)
  })

  it('200 — déchiffre libellé et montant', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([txRow({ category: catRow() })])
    mockPrisma.transaction.count.mockResolvedValue(1)

    const res = await app.inject({ method: 'GET', url: '/api/transactions', headers: auth() })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      total: 1,
      items: [{
        id: TX_ID,
        title: 'Carrefour',
        amount: 4250,
        date: '2026-09-05',
        type: 'expense',
        note: null,
        recurringId: null,
        category: { id: CAT_ID, name: 'Courses', color: '#4ade80' },
      }],
    })
  })

  it('filtre sur l\'utilisateur du token', async () => {
    await app.inject({ method: 'GET', url: '/api/transactions', headers: auth() })

    expect(mockPrisma.transaction.findMany.mock.calls[0][0].where).toEqual({ userId: USER_ID })
  })

  it('applique les filtres type, catégorie et période', async () => {
    await app.inject({
      method: 'GET',
      url: '/api/transactions?type=expense&categoryId=' + CAT_ID + '&from=2026-09-01&to=2026-09-30',
      headers: auth(),
    })

    const { where } = mockPrisma.transaction.findMany.mock.calls[0][0]
    expect(where.type).toBe('expense')
    expect(where.categoryId).toBe(CAT_ID)
    expect(where.date.gte).toEqual(new Date('2026-09-01'))
    expect(where.date.lte).toEqual(new Date('2026-09-30'))
  })

  it('trie du plus récent au plus ancien', async () => {
    await app.inject({ method: 'GET', url: '/api/transactions', headers: auth() })

    expect(mockPrisma.transaction.findMany.mock.calls[0][0].orderBy[0]).toEqual({ date: 'desc' })
  })

  it('400 — type de filtre inconnu', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/transactions?type=virement', headers: auth(),
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /api/summary', () => {
  const currentMonth = new Date().toISOString().slice(0, 7)

  it('calcule solde, revenus et dépenses', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      txRow({ amount: 210000, type: 'income',  date: `${currentMonth}-01`, id: 'a' }),
      txRow({ amount: 4250,   type: 'expense', date: `${currentMonth}-05`, id: 'b' }),
      txRow({ amount: 1000,   type: 'expense', date: '2020-01-05',         id: 'c' }),
    ])

    const res = await app.inject({ method: 'GET', url: '/api/summary', headers: auth() })
    const body = res.json()

    expect(body.income).toBe(210000)
    expect(body.expense).toBe(5250)
    expect(body.balance).toBe(204750)
    expect(body.count).toBe(3)
  })

  it('isole les totaux du mois en cours', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      txRow({ amount: 210000, type: 'income',  date: `${currentMonth}-01`, id: 'a' }),
      txRow({ amount: 4250,   type: 'expense', date: `${currentMonth}-05`, id: 'b' }),
      txRow({ amount: 99999,  type: 'expense', date: '2020-01-05',         id: 'c' }),
    ])

    const body = (await app.inject({ method: 'GET', url: '/api/summary', headers: auth() })).json()

    expect(body.month).toBe(currentMonth)
    expect(body.monthIncome).toBe(210000)
    expect(body.monthExpense).toBe(4250)
  })

  it('renvoie au plus 5 transactions récentes', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => txRow({ id: `tx-${i}` }))
    )

    const body = (await app.inject({ method: 'GET', url: '/api/summary', headers: auth() })).json()

    expect(body.recent).toHaveLength(5)
  })

  it('renvoie des totaux à zéro sans transaction', async () => {
    const body = (await app.inject({ method: 'GET', url: '/api/summary', headers: auth() })).json()

    expect(body).toMatchObject({ balance: 0, income: 0, expense: 0, count: 0, recent: [] })
  })

  it('401 sans token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/summary' })
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /api/transactions', () => {
  it('201 — chiffre le libellé et le montant', async () => {
    mockPrisma.transaction.create.mockImplementation(async ({ data }: any) => ({
      id: TX_ID, ...data, category: null,
    }))

    const res = await app.inject({
      method: 'POST', url: '/api/transactions', headers: auth(),
      payload: { title: 'Carrefour', amount: 4250, date: '2026-09-05', type: 'expense' },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ title: 'Carrefour', amount: 4250, type: 'expense' })

    const { data } = mockPrisma.transaction.create.mock.calls[0][0]
    expect(data.titleEncrypted).not.toContain('Carrefour')
    expect(data.amountEncrypted).not.toContain('4250')
    expect(decryptValue(data.titleEncrypted, TITLE_USAGE)).toBe('Carrefour')
    expect(decryptValue(data.amountEncrypted, AMOUNT_USAGE)).toBe('4250')
  })

  it('rattache la transaction à l\'utilisateur du token', async () => {
    mockPrisma.transaction.create.mockImplementation(async ({ data }: any) => ({
      id: TX_ID, ...data, category: null,
    }))

    await app.inject({
      method: 'POST', url: '/api/transactions', headers: auth(),
      payload: { title: 'Test', amount: 100, date: '2026-09-05' },
    })

    expect(mockPrisma.transaction.create.mock.calls[0][0].data.userId).toBe(USER_ID)
  })

  it('400 — catégorie appartenant à quelqu\'un d\'autre', async () => {
    mockPrisma.category.findFirst.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST', url: '/api/transactions', headers: auth(),
      payload: { title: 'Test', amount: 100, date: '2026-09-05', categoryId: CAT_ID },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('CATEGORY_NOT_FOUND')
    expect(mockPrisma.transaction.create).not.toHaveBeenCalled()
  })

  it('400 — montant négatif ou nul', async () => {
    for (const amount of [0, -100]) {
      const res = await app.inject({
        method: 'POST', url: '/api/transactions', headers: auth(),
        payload: { title: 'Test', amount, date: '2026-09-05' },
      })
      expect(res.statusCode).toBe(400)
    }
  })

  it('400 — montant décimal (les centimes sont des entiers)', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/transactions', headers: auth(),
      payload: { title: 'Test', amount: 42.5, date: '2026-09-05' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('400 — type inconnu', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/transactions', headers: auth(),
      payload: { title: 'Test', amount: 100, date: '2026-09-05', type: 'virement' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('401 sans token', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/transactions',
      payload: { title: 'Test', amount: 100, date: '2026-09-05' },
    })
    expect(res.statusCode).toBe(401)
  })
})

describe('PUT /api/transactions/:id', () => {
  it('200 — modifie le montant', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValue({ id: TX_ID })
    mockPrisma.transaction.update.mockResolvedValue(txRow({ amount: 5000 }))

    const res = await app.inject({
      method: 'PUT', url: `/api/transactions/${TX_ID}`, headers: auth(),
      payload: { amount: 5000 },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().amount).toBe(5000)
  })

  it('404 — transaction d\'un autre utilisateur', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValue(null)

    const res = await app.inject({
      method: 'PUT', url: `/api/transactions/${TX_ID}`, headers: auth(),
      payload: { amount: 1 },
    })

    expect(res.statusCode).toBe(404)
    expect(mockPrisma.transaction.update).not.toHaveBeenCalled()
  })

  it('permet de détacher la catégorie', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValue({ id: TX_ID })
    mockPrisma.transaction.update.mockResolvedValue(txRow())

    await app.inject({
      method: 'PUT', url: `/api/transactions/${TX_ID}`, headers: auth(),
      payload: { categoryId: null },
    })

    expect(mockPrisma.transaction.update.mock.calls[0][0].data.categoryId).toBeNull()
  })
})

describe('DELETE /api/transactions/:id', () => {
  it('200 — supprime', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValue({ id: TX_ID })
    mockPrisma.transaction.delete.mockResolvedValue({ id: TX_ID })

    const res = await app.inject({
      method: 'DELETE', url: `/api/transactions/${TX_ID}`, headers: auth(),
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ id: TX_ID, deleted: true })
  })

  it('404 — transaction d\'un autre utilisateur', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValue(null)

    const res = await app.inject({
      method: 'DELETE', url: `/api/transactions/${TX_ID}`, headers: auth(),
    })

    expect(res.statusCode).toBe(404)
    expect(mockPrisma.transaction.delete).not.toHaveBeenCalled()
  })
})
