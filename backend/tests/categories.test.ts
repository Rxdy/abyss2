/**
 * Tests d'intégration — routes /api/categories
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { buildApp } from '../src/app.js'

beforeAll(() => {
  process.env.MASTER_SECRET = 'b'.repeat(64)
  process.env.JWT_SECRET    = 'test-jwt-secret'
})

const { encryptValue, decryptValue } = await import('../src/utils/crypto.js')
const { CATEGORY_USAGE } = await import('../src/routes/categories.js')

const USER_ID = '11111111-1111-1111-1111-111111111111'
const CAT_ID  = '22222222-2222-2222-2222-222222222222'

function categoryRow(name: string, overrides: Record<string, unknown> = {}) {
  return {
    id: CAT_ID,
    userId: USER_ID,
    nameEncrypted: encryptValue(name, CATEGORY_USAGE),
    color: '#4ade80',
    position: 0,
    ...overrides,
  }
}

let app: any
let mockPrisma: any
let token: string

beforeEach(async () => {
  mockPrisma = {
    user:     { findUnique: vi.fn(), create: vi.fn() },
    category: {
      findMany:   vi.fn().mockResolvedValue([]),
      findFirst:  vi.fn(),
      create:     vi.fn(),
      update:     vi.fn(),
      delete:     vi.fn(),
      count:      vi.fn().mockResolvedValue(0),
      createMany: vi.fn(),
    },
    transaction: { findMany: vi.fn(), count: vi.fn(), updateMany: vi.fn() },
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

describe('GET /api/categories', () => {
  it('401 sans token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/categories' })
    expect(res.statusCode).toBe(401)
  })

  it('200 — déchiffre les libellés', async () => {
    mockPrisma.category.findMany.mockResolvedValue([
      categoryRow('Alimentation'),
      categoryRow('Transport', { id: 'other-id', color: '#4f8ef7', position: 1 }),
    ])

    const res = await app.inject({ method: 'GET', url: '/api/categories', headers: auth() })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([
      { id: CAT_ID,     name: 'Alimentation', color: '#4ade80', position: 0, parentId: null, transactionCount: 0, childrenCount: 0 },
      { id: 'other-id', name: 'Transport',    color: '#4f8ef7', position: 1, parentId: null, transactionCount: 0, childrenCount: 0 },
    ])
  })

  it('ne renvoie que les catégories de l\'utilisateur du token', async () => {
    await app.inject({ method: 'GET', url: '/api/categories', headers: auth() })

    expect(mockPrisma.category.findMany.mock.calls[0][0].where).toEqual({ userId: USER_ID })
  })
})

describe('POST /api/categories', () => {
  it('201 — chiffre le nom, garde la couleur en clair', async () => {
    mockPrisma.category.create.mockImplementation(async ({ data }: any) => ({ id: CAT_ID, ...data }))

    const res = await app.inject({
      method: 'POST',
      url: '/api/categories',
      headers: auth(),
      payload: { name: 'Courses', color: '#4ade80' },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ name: 'Courses', color: '#4ade80' })

    const { data } = mockPrisma.category.create.mock.calls[0][0]
    expect(data.nameEncrypted).not.toContain('Courses')
    expect(decryptValue(data.nameEncrypted, CATEGORY_USAGE)).toBe('Courses')
    expect(data.color).toBe('#4ade80')
    expect(data.userId).toBe(USER_ID)
  })

  it('place la nouvelle catégorie en fin de liste', async () => {
    mockPrisma.category.count.mockResolvedValue(3)
    mockPrisma.category.create.mockImplementation(async ({ data }: any) => ({ id: CAT_ID, ...data }))

    await app.inject({
      method: 'POST', url: '/api/categories', headers: auth(), payload: { name: 'Courses' },
    })

    expect(mockPrisma.category.create.mock.calls[0][0].data.position).toBe(3)
  })

  it('400 — nom vide', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/categories', headers: auth(), payload: { name: '' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('400 — couleur qui n\'est pas un hex', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/categories', headers: auth(),
      payload: { name: 'Courses', color: 'rouge' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('401 sans token', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/categories', payload: { name: 'Courses' },
    })
    expect(res.statusCode).toBe(401)
    expect(mockPrisma.category.create).not.toHaveBeenCalled()
  })
})

describe('PUT /api/categories/:id', () => {
  it('200 — met à jour le nom', async () => {
    mockPrisma.category.findFirst.mockResolvedValue({ id: CAT_ID })
    mockPrisma.category.update.mockResolvedValue(categoryRow('Alimentation & courses'))

    const res = await app.inject({
      method: 'PUT', url: `/api/categories/${CAT_ID}`, headers: auth(),
      payload: { name: 'Alimentation & courses' },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json().name).toBe('Alimentation & courses')
  })

  it('404 — catégorie d\'un autre utilisateur', async () => {
    mockPrisma.category.findFirst.mockResolvedValue(null)

    const res = await app.inject({
      method: 'PUT', url: `/api/categories/${CAT_ID}`, headers: auth(),
      payload: { name: 'Piratage' },
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().code).toBe('CATEGORY_NOT_FOUND')
    expect(mockPrisma.category.update).not.toHaveBeenCalled()
  })

  it('vérifie l\'appartenance avant de modifier', async () => {
    mockPrisma.category.findFirst.mockResolvedValue({ id: CAT_ID })
    mockPrisma.category.update.mockResolvedValue(categoryRow('X'))

    await app.inject({
      method: 'PUT', url: `/api/categories/${CAT_ID}`, headers: auth(), payload: { name: 'X' },
    })

    expect(mockPrisma.category.findFirst.mock.calls[0][0].where)
      .toEqual({ id: CAT_ID, userId: USER_ID })
  })
})

describe('POST /api/categories — sous-catégories', () => {
  const PARENT_ID = '33333333-3333-3333-3333-333333333333'

  it('201 — crée une sous-catégorie avec un parentId valide', async () => {
    mockPrisma.category.findFirst.mockResolvedValue({ id: PARENT_ID, parentId: null })
    mockPrisma.category.create.mockImplementation(async ({ data }: any) => ({ id: CAT_ID, ...data }))

    const res = await app.inject({
      method: 'POST', url: '/api/categories', headers: auth(),
      payload: { name: 'Restaurant', parentId: PARENT_ID },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json().parentId).toBe(PARENT_ID)
  })

  it('400 — parentId introuvable', async () => {
    mockPrisma.category.findFirst.mockResolvedValue(null)

    const res = await app.inject({
      method: 'POST', url: '/api/categories', headers: auth(),
      payload: { name: 'Restaurant', parentId: PARENT_ID },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('PARENT_NOT_FOUND')
    expect(mockPrisma.category.create).not.toHaveBeenCalled()
  })

  it('400 — refuse une profondeur de plus d\'un niveau', async () => {
    mockPrisma.category.findFirst.mockResolvedValue({ id: PARENT_ID, parentId: 'grandparent-id' })

    const res = await app.inject({
      method: 'POST', url: '/api/categories', headers: auth(),
      payload: { name: 'Fast-food', parentId: PARENT_ID },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('PARENT_TOO_DEEP')
    expect(mockPrisma.category.create).not.toHaveBeenCalled()
  })
})

describe('PUT /api/categories/:id — sous-catégories', () => {
  const PARENT_ID = '33333333-3333-3333-3333-333333333333'

  it('400 — une catégorie ne peut pas être sa propre parente', async () => {
    mockPrisma.category.findFirst.mockResolvedValueOnce({ id: CAT_ID, _count: { transactions: 0, children: 0 } })

    const res = await app.inject({
      method: 'PUT', url: `/api/categories/${CAT_ID}`, headers: auth(),
      payload: { parentId: CAT_ID },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('CATEGORY_SELF_PARENT')
  })

  it('400 — une catégorie avec des enfants ne peut pas devenir une sous-catégorie', async () => {
    mockPrisma.category.findFirst
      .mockResolvedValueOnce({ id: CAT_ID, _count: { transactions: 0, children: 2 } }) // existing
      .mockResolvedValueOnce({ id: PARENT_ID, parentId: null }) // parent lookup

    const res = await app.inject({
      method: 'PUT', url: `/api/categories/${CAT_ID}`, headers: auth(),
      payload: { parentId: PARENT_ID },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('CATEGORY_HAS_CHILDREN')
    expect(mockPrisma.category.update).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/categories/:id', () => {
  it('200 — supprime', async () => {
    mockPrisma.category.findFirst.mockResolvedValue({ id: CAT_ID })
    mockPrisma.category.delete.mockResolvedValue({ id: CAT_ID })

    const res = await app.inject({
      method: 'DELETE', url: `/api/categories/${CAT_ID}`, headers: auth(),
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ id: CAT_ID, deleted: true })
    expect(mockPrisma.transaction.updateMany).not.toHaveBeenCalled()
  })

  it('404 — catégorie d\'un autre utilisateur', async () => {
    mockPrisma.category.findFirst.mockResolvedValue(null)

    const res = await app.inject({
      method: 'DELETE', url: `/api/categories/${CAT_ID}`, headers: auth(),
    })

    expect(res.statusCode).toBe(404)
    expect(mockPrisma.category.delete).not.toHaveBeenCalled()
  })

  it('200 — recatégorise les transactions vers reassignTo avant de supprimer', async () => {
    const OTHER_ID = '44444444-4444-4444-4444-444444444444'
    mockPrisma.category.findFirst
      .mockResolvedValueOnce({ id: CAT_ID })   // existing
      .mockResolvedValueOnce({ id: OTHER_ID }) // target
    mockPrisma.category.delete.mockResolvedValue({ id: CAT_ID })

    const res = await app.inject({
      method: 'DELETE', url: `/api/categories/${CAT_ID}`, headers: auth(),
      payload: { reassignTo: OTHER_ID },
    })

    expect(res.statusCode).toBe(200)
    expect(mockPrisma.transaction.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, categoryId: CAT_ID },
      data:  { categoryId: OTHER_ID },
    })
  })

  it('400 — reassignTo vers soi-même', async () => {
    mockPrisma.category.findFirst.mockResolvedValue({ id: CAT_ID })

    const res = await app.inject({
      method: 'DELETE', url: `/api/categories/${CAT_ID}`, headers: auth(),
      payload: { reassignTo: CAT_ID },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('CATEGORY_SELF_REASSIGN')
    expect(mockPrisma.category.delete).not.toHaveBeenCalled()
  })
})
