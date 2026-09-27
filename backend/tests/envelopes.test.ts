/**
 * Tests d'intégration — routes /api/envelopes
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { buildApp } from '../src/app.js'

beforeAll(() => {
  process.env.MASTER_SECRET = 'b'.repeat(64)
  process.env.JWT_SECRET    = 'test-jwt-secret'
})

const { encryptValue, decryptValue } = await import('../src/utils/crypto.js')

const NAME_USAGE   = 'envelope-name'
const BUDGET_USAGE = 'envelope-budget'

const USER_ID = '11111111-1111-1111-1111-111111111111'
const ENV_ID  = '55555555-5555-5555-5555-555555555555'
const CAT_ID  = '22222222-2222-2222-2222-222222222222'
const CAT_ID2 = '33333333-3333-3333-3333-333333333333'

function envelopeRow(name: string, budget: number, overrides: Record<string, unknown> = {}) {
  return {
    id: ENV_ID,
    userId: USER_ID,
    nameEncrypted: encryptValue(name, NAME_USAGE),
    budgetEncrypted: encryptValue(String(budget), BUDGET_USAGE),
    categories: [],
    ...overrides,
  }
}

let app: any
let mockPrisma: any
let token: string

beforeEach(async () => {
  mockPrisma = {
    user:     { findUnique: vi.fn().mockResolvedValue({ tokenVersion: 0 }), create: vi.fn() },
    envelope: {
      findMany:         vi.fn().mockResolvedValue([]),
      findFirst:        vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create:            vi.fn(),
      update:            vi.fn(),
      delete:            vi.fn(),
    },
    category: {
      count:      vi.fn().mockResolvedValue(0),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
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

describe('GET /api/envelopes', () => {
  it('401 sans token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/envelopes' })
    expect(res.statusCode).toBe(401)
  })

  it('200 — déchiffre le nom et le budget, expose les catégories liées', async () => {
    mockPrisma.envelope.findMany.mockResolvedValue([
      envelopeRow('Alimentation', 40000, { categories: [{ id: CAT_ID }, { id: CAT_ID2 }] }),
    ])

    const res = await app.inject({ method: 'GET', url: '/api/envelopes', headers: auth() })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([
      { id: ENV_ID, name: 'Alimentation', budget: 40000, categoryIds: [CAT_ID, CAT_ID2] },
    ])
  })

  it('ne renvoie que les enveloppes de l\'utilisateur du token', async () => {
    await app.inject({ method: 'GET', url: '/api/envelopes', headers: auth() })

    expect(mockPrisma.envelope.findMany.mock.calls[0][0].where).toEqual({ userId: USER_ID })
  })
})

describe('POST /api/envelopes', () => {
  beforeEach(() => {
    mockPrisma.envelope.create.mockImplementation(async ({ data }: any) => ({ id: ENV_ID, ...data }))
    mockPrisma.envelope.findUniqueOrThrow.mockImplementation(async () => envelopeRow('Alimentation', 40000))
  })

  it('201 — chiffre le nom et le budget', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/envelopes', headers: auth(),
      payload: { name: 'Alimentation', budget: 40000 },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ name: 'Alimentation', budget: 40000 })

    const { data } = mockPrisma.envelope.create.mock.calls[0][0]
    expect(data.nameEncrypted).not.toContain('Alimentation')
    expect(decryptValue(data.nameEncrypted, NAME_USAGE)).toBe('Alimentation')
    expect(decryptValue(data.budgetEncrypted, BUDGET_USAGE)).toBe('40000')
    expect(data.userId).toBe(USER_ID)
  })

  it('rattache les catégories fournies à la nouvelle enveloppe', async () => {
    mockPrisma.category.count.mockResolvedValue(2)

    await app.inject({
      method: 'POST', url: '/api/envelopes', headers: auth(),
      payload: { name: 'Alimentation', budget: 40000, categoryIds: [CAT_ID, CAT_ID2] },
    })

    expect(mockPrisma.category.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, id: { in: [CAT_ID, CAT_ID2] } },
      data:  { envelopeId: ENV_ID },
    })
  })

  it('400 — une catégorie liée n\'appartient pas à l\'utilisateur', async () => {
    mockPrisma.category.count.mockResolvedValue(1) // une seule des deux trouvée

    const res = await app.inject({
      method: 'POST', url: '/api/envelopes', headers: auth(),
      payload: { name: 'Alimentation', budget: 40000, categoryIds: [CAT_ID, CAT_ID2] },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('CATEGORY_NOT_FOUND')
    expect(mockPrisma.envelope.create).not.toHaveBeenCalled()
  })

  it('400 — nom vide', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/envelopes', headers: auth(), payload: { name: '', budget: 40000 },
    })
    expect(res.statusCode).toBe(400)
  })

  it.each([0, -5, 12.5, 100_000_001, 'beaucoup'])('400 — budget invalide (%s)', async (budget) => {
    const res = await app.inject({
      method: 'POST', url: '/api/envelopes', headers: auth(), payload: { name: 'Alimentation', budget },
    })

    expect(res.statusCode).toBe(400)
    expect(mockPrisma.envelope.create).not.toHaveBeenCalled()
  })

  it('401 sans token', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/envelopes', payload: { name: 'Alimentation', budget: 40000 },
    })
    expect(res.statusCode).toBe(401)
    expect(mockPrisma.envelope.create).not.toHaveBeenCalled()
  })
})

describe('PUT /api/envelopes/:id', () => {
  beforeEach(() => {
    mockPrisma.envelope.findFirst.mockResolvedValue({ id: ENV_ID })
    mockPrisma.envelope.update.mockResolvedValue(envelopeRow('Alimentation', 40000))
    mockPrisma.envelope.findUniqueOrThrow.mockImplementation(async () => envelopeRow('Loisirs', 25000))
  })

  it('200 — met à jour le nom et le budget', async () => {
    const res = await app.inject({
      method: 'PUT', url: `/api/envelopes/${ENV_ID}`, headers: auth(),
      payload: { name: 'Loisirs', budget: 25000 },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ name: 'Loisirs', budget: 25000 })
    expect(decryptValue(mockPrisma.envelope.update.mock.calls[0][0].data.nameEncrypted, NAME_USAGE)).toBe('Loisirs')
    expect(decryptValue(mockPrisma.envelope.update.mock.calls[0][0].data.budgetEncrypted, BUDGET_USAGE)).toBe('25000')
  })

  it('404 — enveloppe d\'un autre utilisateur', async () => {
    mockPrisma.envelope.findFirst.mockResolvedValue(null)

    const res = await app.inject({
      method: 'PUT', url: `/api/envelopes/${ENV_ID}`, headers: auth(), payload: { name: 'Piratage' },
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().code).toBe('ENVELOPE_NOT_FOUND')
    expect(mockPrisma.envelope.update).not.toHaveBeenCalled()
  })

  it('détache les catégories retirées et rattache les nouvelles', async () => {
    mockPrisma.category.count.mockResolvedValue(1)

    await app.inject({
      method: 'PUT', url: `/api/envelopes/${ENV_ID}`, headers: auth(),
      payload: { categoryIds: [CAT_ID2] },
    })

    expect(mockPrisma.category.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, envelopeId: ENV_ID, id: { notIn: [CAT_ID2] } },
      data:  { envelopeId: null },
    })
    expect(mockPrisma.category.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, id: { in: [CAT_ID2] } },
      data:  { envelopeId: ENV_ID },
    })
  })

  it('categoryIds vide détache toutes les catégories', async () => {
    await app.inject({
      method: 'PUT', url: `/api/envelopes/${ENV_ID}`, headers: auth(), payload: { categoryIds: [] },
    })

    expect(mockPrisma.category.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, envelopeId: ENV_ID, id: { notIn: [] } },
      data:  { envelopeId: null },
    })
    expect(mockPrisma.category.updateMany).toHaveBeenCalledTimes(1)
  })

  it('categoryIds absent : les catégories liées ne changent pas', async () => {
    await app.inject({
      method: 'PUT', url: `/api/envelopes/${ENV_ID}`, headers: auth(), payload: { name: 'Loisirs' },
    })

    expect(mockPrisma.category.updateMany).not.toHaveBeenCalled()
  })

  it('400 — une catégorie liée n\'appartient pas à l\'utilisateur', async () => {
    mockPrisma.category.count.mockResolvedValue(0)

    const res = await app.inject({
      method: 'PUT', url: `/api/envelopes/${ENV_ID}`, headers: auth(), payload: { categoryIds: [CAT_ID] },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('CATEGORY_NOT_FOUND')
    expect(mockPrisma.envelope.update).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/envelopes/:id', () => {
  it('200 — supprime, les catégories liées sont conservées', async () => {
    mockPrisma.envelope.findFirst.mockResolvedValue({ id: ENV_ID })
    mockPrisma.envelope.delete.mockResolvedValue({ id: ENV_ID })

    const res = await app.inject({ method: 'DELETE', url: `/api/envelopes/${ENV_ID}`, headers: auth() })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ id: ENV_ID, deleted: true })
    expect(mockPrisma.category.updateMany).not.toHaveBeenCalled()
  })

  it('404 — enveloppe d\'un autre utilisateur', async () => {
    mockPrisma.envelope.findFirst.mockResolvedValue(null)

    const res = await app.inject({ method: 'DELETE', url: `/api/envelopes/${ENV_ID}`, headers: auth() })

    expect(res.statusCode).toBe(404)
    expect(mockPrisma.envelope.delete).not.toHaveBeenCalled()
  })

  it('401 sans token', async () => {
    const res = await app.inject({ method: 'DELETE', url: `/api/envelopes/${ENV_ID}` })
    expect(res.statusCode).toBe(401)
  })
})
