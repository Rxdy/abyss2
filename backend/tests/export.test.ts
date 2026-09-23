/**
 * Tests d'intégration — GET /api/user/export
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { buildApp } from '../src/app.js'

beforeAll(() => {
  process.env.MASTER_SECRET = 'b'.repeat(64)
  process.env.JWT_SECRET    = 'test-jwt-secret'
})

const { encryptEmail, encryptValue } = await import('../src/utils/crypto.js')
const { CATEGORY_USAGE } = await import('../src/routes/categories.js')
const { TITLE_USAGE, AMOUNT_USAGE } = await import('../src/routes/transactions.js')

const USER_ID  = '11111111-1111-1111-1111-111111111111'
const FOOD_ID  = '22222222-2222-2222-2222-222222222222'
const RESTO_ID = '33333333-3333-3333-3333-333333333333' // sous-catégorie de FOOD

let app: any
let mockPrisma: any
let token: string

const category = (id: string, name: string, parentId: string | null = null) =>
  ({ id, userId: USER_ID, parentId, nameEncrypted: encryptValue(name, CATEGORY_USAGE), color: '#ff0000', position: 0 })

const transaction = (over: any) => ({
  id: 'tx-' + Math.random(), userId: USER_ID, categoryId: null, recurringId: null, type: 'expense', note: null,
  date: new Date('2026-03-10'), titleEncrypted: encryptValue('Libellé', TITLE_USAGE),
  amountEncrypted: encryptValue('1000', AMOUNT_USAGE),
  ...over,
})

beforeEach(async () => {
  mockPrisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        tokenVersion: 0,
        emailEncrypted: encryptEmail('alice@example.com'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    },
    category:             { findMany: vi.fn().mockResolvedValue([category(FOOD_ID, 'Alimentation'), category(RESTO_ID, 'Restaurants', FOOD_ID)]) },
    transaction:          { findMany: vi.fn().mockResolvedValue([]) },
    recurringTransaction: { findMany: vi.fn().mockResolvedValue([]) },
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

const exportData = (qs = '', headers: Record<string, string> = { authorization: `Bearer ${token}` }) =>
  app.inject({ method: 'GET', url: `/api/user/export${qs}`, headers })

describe('GET /api/user/export', () => {
  it('401 — sans token, sans rien lire', async () => {
    const res = await exportData('', {})

    expect(res.statusCode).toBe(401)
    expect(mockPrisma.transaction.findMany).not.toHaveBeenCalled()
  })

  it('200 — JSON par défaut, données déchiffrées', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      transaction({
        titleEncrypted: encryptValue('Déjeuner', TITLE_USAGE),
        amountEncrypted: encryptValue('1850', AMOUNT_USAGE),
        categoryId: RESTO_ID, note: 'avec Marc',
      }),
    ])
    mockPrisma.recurringTransaction.findMany.mockResolvedValue([{
      id: 'rec-1', titleEncrypted: encryptValue('Loyer', TITLE_USAGE), amountEncrypted: encryptValue('78800', AMOUNT_USAGE),
      type: 'expense', dayOfMonth: 5, note: null, active: true,
      startDate: new Date('2026-01-05'), endDate: null, categoryId: FOOD_ID,
    }])

    const res = await exportData()
    const body = res.json()

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('application/json')
    expect(res.headers['cache-control']).toBe('no-store')
    expect(body.account.email).toBe('alice@example.com')
    expect(body.categories).toHaveLength(2)
    expect(body.categories[0]).toMatchObject({ id: FOOD_ID, name: 'Alimentation', parentId: null })
    expect(body.transactions[0]).toMatchObject({
      date: '2026-03-10', type: 'expense', amount: 1850, title: 'Déjeuner', note: 'avec Marc', categoryId: RESTO_ID,
    })
    expect(body.recurring[0]).toMatchObject({ title: 'Loyer', amount: 78800, dayOfMonth: 5, startDate: '2026-01-05', endDate: null })
  })

  it('ne lit que les données de l\'utilisateur du jeton', async () => {
    await exportData()

    expect(mockPrisma.category.findMany.mock.calls[0][0].where).toEqual({ userId: USER_ID })
    expect(mockPrisma.transaction.findMany.mock.calls[0][0].where).toEqual({ userId: USER_ID })
    expect(mockPrisma.recurringTransaction.findMany.mock.calls[0][0].where).toEqual({ userId: USER_ID })
  })

  it('n\'expose ni mot de passe, ni sels, ni valeurs chiffrées', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([transaction({})])

    const res = await exportData()

    expect(res.body).not.toMatch(/passwordHash|Encrypted/)
  })

  it('200 — CSV : une ligne par transaction, catégorie et sous-catégorie séparées', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      transaction({
        titleEncrypted: encryptValue('Déjeuner, resto', TITLE_USAGE),
        amountEncrypted: encryptValue('1850', AMOUNT_USAGE),
        categoryId: RESTO_ID, note: 'avec Marc',
      }),
      transaction({
        type: 'income', date: new Date('2026-03-01'),
        titleEncrypted: encryptValue('Salaire', TITLE_USAGE),
        amountEncrypted: encryptValue('200000', AMOUNT_USAGE),
        categoryId: FOOD_ID,
      }),
      transaction({ titleEncrypted: encryptValue('Sans catégorie', TITLE_USAGE) }),
    ])

    const res = await exportData('?format=csv')
    const lines = res.body.replace(/^\uFEFF/, '').trimEnd().split('\r\n')

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(lines[0]).toBe('date,type,amount,title,category,subcategory,note')
    expect(lines[1]).toBe('2026-03-10,expense,18.50,"Déjeuner, resto",Alimentation,Restaurants,avec Marc')
    expect(lines[2]).toBe('2026-03-01,income,2000.00,Salaire,Alimentation,,')
    expect(lines[3]).toBe('2026-03-10,expense,10.00,Sans catégorie,,,')
  })

  it('CSV — neutralise un libellé qui ressemble à une formule', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([
      transaction({ titleEncrypted: encryptValue('=HYPERLINK("http://evil")', TITLE_USAGE) }),
    ])

    const res = await exportData('?format=csv')

    expect(res.body).toContain(`"'=HYPERLINK(""http://evil"")"`)
  })

  it('400 — format inconnu', async () => {
    const res = await exportData('?format=xml')

    expect(res.statusCode).toBe(400)
  })
})
