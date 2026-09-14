/**
 * Tests d'intégration — route protégée /api/user
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { buildApp } from '../src/app.js'

beforeAll(() => {
  process.env.MASTER_SECRET = 'b'.repeat(64)
  process.env.JWT_SECRET    = 'test-jwt-secret'
})

const bcrypt = (await import('bcryptjs')).default
const { encryptEmail } = await import('../src/utils/crypto.js')

let app: any
let mockPrisma: any
let token: string

beforeEach(async () => {
  mockPrisma = {
    user: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    $disconnect: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([]),
  }
  app = await buildApp({ testing: true, prisma: mockPrisma })
  await app.ready()
  token = app.jwt.sign({ userId: 'uuid-test-user', email: 'alice@example.com' })
})

afterEach(async () => {
  if (app) await app.close()
})

const getUser = (headers: Record<string, string> = {}) =>
  app.inject({ method: 'GET', url: '/api/user', headers })

describe('GET /api/user', () => {
  it('200 — renvoie le profil avec l\'email déchiffré', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'uuid-test-user',
      emailEncrypted: encryptEmail('alice@example.com'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    })

    const res = await getUser({ authorization: `Bearer ${token}` })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      id: 'uuid-test-user',
      email: 'alice@example.com',
    })
  })

  it('cherche l\'utilisateur avec l\'id porté par le token', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'uuid-test-user',
      emailEncrypted: encryptEmail('alice@example.com'),
      createdAt: new Date(),
    })

    await getUser({ authorization: `Bearer ${token}` })

    expect(mockPrisma.user.findUnique.mock.calls[0][0].where).toEqual({ id: 'uuid-test-user' })
  })

  it('401 — sans token', async () => {
    const res = await getUser()

    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBe('UNAUTHORIZED')
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('401 — token malformé', async () => {
    const res = await getUser({ authorization: 'Bearer pas.un.jwt' })
    expect(res.statusCode).toBe(401)
  })

  it('401 — token signé avec une autre clé', async () => {
    const other = await buildApp({ testing: true, prisma: mockPrisma })
    await other.ready()
    // même payload, secret différent
    process.env.JWT_SECRET = 'un-autre-secret'
    const foreign = await buildApp({ testing: true, prisma: mockPrisma })
    await foreign.ready()
    const foreignToken = foreign.jwt.sign({ userId: 'uuid-test-user' })
    process.env.JWT_SECRET = 'test-jwt-secret'

    const res = await getUser({ authorization: `Bearer ${foreignToken}` })

    expect(res.statusCode).toBe(401)

    await other.close()
    await foreign.close()
  })

  it('401 — utilisateur supprimé entre-temps', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const res = await getUser({ authorization: `Bearer ${token}` })

    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBe('USER_NOT_FOUND')
  })
})

describe('DELETE /api/user', () => {
  const del = (payload: any, headers: Record<string, string> = {}) =>
    app.inject({ method: 'DELETE', url: '/api/user', payload, headers })

  it('200 — supprime le compte quand le mot de passe est correct', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'uuid-test-user',
      passwordHash: await bcrypt.hash('correct-horse', 4),
    })
    mockPrisma.user.delete.mockResolvedValue({ id: 'uuid-test-user' })

    const res = await del({ password: 'correct-horse' }, { authorization: `Bearer ${token}` })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ deleted: true })
    expect(mockPrisma.user.delete).toHaveBeenCalledWith({ where: { id: 'uuid-test-user' } })
  })

  it('401 — mauvais mot de passe, ne supprime rien', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'uuid-test-user',
      passwordHash: await bcrypt.hash('correct-horse', 4),
    })

    const res = await del({ password: 'wrong' }, { authorization: `Bearer ${token}` })

    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBe('INVALID_CREDENTIALS')
    expect(mockPrisma.user.delete).not.toHaveBeenCalled()
  })

  it('401 — sans token', async () => {
    const res = await del({ password: 'whatever' })

    expect(res.statusCode).toBe(401)
    expect(mockPrisma.user.delete).not.toHaveBeenCalled()
  })
})
