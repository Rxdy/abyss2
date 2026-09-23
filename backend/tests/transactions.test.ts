/**
 * Tests d'intégration — routes /api/transactions et /api/summary
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { buildApp } from '../src/app.js'
import { currentMonthKey } from '../src/utils/date.js'

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
    user:     { findUnique: vi.fn().mockResolvedValue({ tokenVersion: 0 }) },
    category: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    envelope: { findUnique: vi.fn() },
    notification: { create: vi.fn() },
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
  token = app.jwt.sign({ userId: USER_ID, email: 'alice@example.com', tv: 0 })
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

  it('400 — période invalide (fin avant début)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/transactions?from=2026-02-01&to=2026-01-01',
      headers: auth(),
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('END_BEFORE_START')
    expect(mockPrisma.transaction.findMany).not.toHaveBeenCalled()
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

  it('ne déchiffre le nom d\'une catégorie qu\'une fois pour toute la page', async () => {
    let decryptions = 0
    const category = { id: CAT_ID, color: '#4ade80' }
    Object.defineProperty(category, 'nameEncrypted', {
      get() { decryptions += 1; return encryptValue('Courses', CATEGORY_USAGE) },
    })
    mockPrisma.transaction.findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => txRow({ id: `tx-${i}`, category }))
    )
    mockPrisma.transaction.count.mockResolvedValue(5)

    const res = await app.inject({ method: 'GET', url: '/api/transactions', headers: auth() })

    expect(res.json().items.map((t: any) => t.category.name)).toEqual(Array(5).fill('Courses'))
    expect(decryptions).toBe(1)
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

  it('categoryId=none filtre les transactions sans catégorie', async () => {
    await app.inject({ method: 'GET', url: '/api/transactions?categoryId=none', headers: auth() })

    const { where } = mockPrisma.transaction.findMany.mock.calls[0][0]
    expect(where.categoryId).toBeNull()
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
  const currentMonth = currentMonthKey()
  const summary = (qs = '') => app.inject({ method: 'GET', url: `/api/summary${qs}`, headers: auth() })

  /**
   * Base factice : la requête « légère » (avec `select`) renvoie toutes les lignes, la requête
   * « récentes » (avec `take`) applique le filtre de dates, le tri et la limite, comme PostgreSQL.
   */
  function seed(rows: any[]) {
    mockPrisma.transaction.findMany.mockImplementation(async (args: any) => {
      if (!args.take) return rows
      const { gte, lte } = args.where.date ?? {}
      return rows
        .filter((r) => (!gte || r.date >= gte) && (!lte || r.date <= lte))
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, args.take)
    })
  }

  it('calcule solde, revenus et dépenses', async () => {
    seed([
      txRow({ amount: 210000, type: 'income',  date: `${currentMonth}-01`, id: 'a' }),
      txRow({ amount: 4250,   type: 'expense', date: `${currentMonth}-05`, id: 'b' }),
      txRow({ amount: 1000,   type: 'expense', date: '2020-01-05',         id: 'c' }),
    ])

    const body = (await summary()).json()

    expect(body.income).toBe(210000)
    expect(body.expense).toBe(5250)
    expect(body.balance).toBe(204750)
    expect(body.count).toBe(3)
  })

  it('isole les totaux du mois en cours par défaut', async () => {
    seed([
      txRow({ amount: 210000, type: 'income',  date: `${currentMonth}-01`, id: 'a' }),
      txRow({ amount: 4250,   type: 'expense', date: `${currentMonth}-05`, id: 'b' }),
      txRow({ amount: 99999,  type: 'expense', date: '2020-01-05',         id: 'c' }),
    ])

    const body = (await summary()).json()

    expect(body.month).toBe(currentMonth)
    expect(body.monthIncome).toBe(210000)
    expect(body.monthExpense).toBe(4250)
  })

  it('le mois courant suit la date de Paris : 22 h 30 UTC le 30 juin est déjà juillet', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-06-30T22:30:00Z'))
    try {
      seed([
        txRow({ amount: 1000, date: '2026-07-01', id: 'a' }),
        txRow({ amount: 5000, date: '2026-06-20', id: 'b' }),
      ])

      const body = (await summary()).json()

      expect(body.month).toBe('2026-07')
      expect(body.currentMonth).toBe('2026-07')
      expect(body.monthExpense).toBe(1000)
    } finally {
      vi.useRealTimers()
    }
  })

  describe('navigation par mois', () => {
    const rows = () => [
      txRow({ amount: 10000, type: 'expense', date: '2026-03-10', id: 'mar-1' }),
      txRow({ amount: 2500,  type: 'expense', date: '2026-03-20', id: 'mar-2' }),
      txRow({ amount: 90000, type: 'income',  date: '2026-03-01', id: 'mar-3' }),
      txRow({ amount: 7000,  type: 'expense', date: '2026-02-15', id: 'fev-1' }),
      txRow({ amount: 300,   type: 'expense', date: `${currentMonth}-02`, id: 'now-1' }),
    ]

    it('?month= renvoie les totaux de ce mois, les soldes globaux restent inchangés', async () => {
      seed(rows())

      const body = (await summary('?month=2026-03')).json()

      expect(body.month).toBe('2026-03')
      expect(body.monthExpense).toBe(12500)
      expect(body.monthIncome).toBe(90000)
      expect(body.balance).toBe(90000 - (10000 + 2500 + 7000 + 300))
      expect(body.count).toBe(5)
    })

    it('les transactions récentes sont celles de CE mois, la plus récente d\'abord', async () => {
      seed(rows())

      const body = (await summary('?month=2026-03')).json()

      expect(body.recent.map((t: any) => t.id)).toEqual(['mar-2', 'mar-1', 'mar-3'])
    })

    it('un mois sans transaction : totaux à zéro, aucune récente, soldes globaux conservés', async () => {
      seed(rows())

      const body = (await summary('?month=2025-01')).json()

      expect(body).toMatchObject({ month: '2025-01', monthIncome: 0, monthExpense: 0, recent: [] })
      expect(body.count).toBe(5)
    })

    it('expose les bornes de navigation : plus ancien mois et mois courant', async () => {
      seed(rows())

      const body = (await summary()).json()

      expect(body.firstMonth).toBe('2026-02')
      expect(body.currentMonth).toBe(currentMonth)
    })

    it('sans aucune transaction : pas de plus ancien mois', async () => {
      seed([])

      expect((await summary()).json().firstMonth).toBeNull()
    })

    it('la fin de mois est incluse (28 février, 31 mars)', async () => {
      seed([
        txRow({ amount: 100, date: '2026-02-28', id: 'feb-end' }),
        txRow({ amount: 200, date: '2026-03-31', id: 'mar-end' }),
        txRow({ amount: 400, date: '2026-04-01', id: 'apr-start' }),
      ])

      expect((await summary('?month=2026-02')).json().recent.map((t: any) => t.id)).toEqual(['feb-end'])
      expect((await summary('?month=2026-03')).json().recent.map((t: any) => t.id)).toEqual(['mar-end'])
    })

    it.each(['2026-13', '2026-00', '26-03', '2026-3', 'mars', '2026-03-01'])('400 — mois invalide « %s »', async (month) => {
      const res = await summary(`?month=${month}`)

      expect(res.statusCode).toBe(400)
    })
  })

  it('renvoie au plus 5 transactions récentes', async () => {
    seed(Array.from({ length: 8 }, (_, i) => txRow({ id: `tx-${i}`, date: `${currentMonth}-0${i + 1}` })))

    const body = (await summary()).json()

    expect(body.recent).toHaveLength(5)
  })

  it('déchiffre les libellés et catégories des seules lignes récentes', async () => {
    seed([txRow({ amount: 500, title: 'Boulangerie', date: `${currentMonth}-03`, category: catRow() })])

    const body = (await summary()).json()

    expect(body.recent[0]).toMatchObject({ title: 'Boulangerie', category: { name: 'Courses' } })
  })

  it('la lecture des totaux ne charge ni libellé ni catégorie', async () => {
    seed([txRow({ date: `${currentMonth}-03` })])

    await summary()

    const light = mockPrisma.transaction.findMany.mock.calls.map((c: any) => c[0]).find((a: any) => !a.take)
    expect(Object.keys(light.select).sort()).toEqual(['amountEncrypted', 'date', 'type'])
    expect(light.include).toBeUndefined()
  })

  it('renvoie des totaux à zéro sans transaction', async () => {
    const body = (await summary()).json()

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

  it('409 — la nouvelle date entre en collision avec une autre échéance de la même charge fixe', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValue({ id: TX_ID })
    mockPrisma.transaction.update.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }))

    const res = await app.inject({
      method: 'PUT', url: `/api/transactions/${TX_ID}`, headers: auth(),
      payload: { date: '2026-03-05' },
    })

    expect(res.statusCode).toBe(409)
    expect(res.json().code).toBe('DUPLICATE_OCCURRENCE')
    expect(res.json().error).toContain('existe déjà à cette date')
  })

  it('500 — une autre erreur de la base n\'est pas prise pour un doublon', async () => {
    mockPrisma.transaction.findFirst.mockResolvedValue({ id: TX_ID })
    mockPrisma.transaction.update.mockRejectedValue(Object.assign(new Error('boom'), { code: 'P2025' }))

    const res = await app.inject({
      method: 'PUT', url: `/api/transactions/${TX_ID}`, headers: auth(),
      payload: { amount: 1 },
    })

    expect(res.statusCode).toBe(500)
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
