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
    user: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), update: vi.fn() },
    $disconnect: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([]),
  }
  app = await buildApp({ testing: true, prisma: mockPrisma })
  await app.ready()
  token = app.jwt.sign({ userId: 'uuid-test-user', email: 'alice@example.com', tv: 0 })
})

afterEach(async () => {
  if (app) await app.close()
})

const getUser = (headers: Record<string, string> = {}) =>
  app.inject({ method: 'GET', url: '/api/user', headers })

describe('GET /api/user', () => {
  it('200 — renvoie le profil avec l\'email déchiffré', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'uuid-test-user', tokenVersion: 0,
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
      id: 'uuid-test-user', tokenVersion: 0,
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
    expect(res.json().code).toBe('TOKEN_REVOKED')
  })
})

describe('DELETE /api/user', () => {
  const del = (payload: any, headers: Record<string, string> = {}) =>
    app.inject({ method: 'DELETE', url: '/api/user', payload, headers })

  it('200 — supprime le compte quand le mot de passe est correct', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'uuid-test-user', tokenVersion: 0,
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
      id: 'uuid-test-user', tokenVersion: 0,
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

describe('Jetons versionnés (tv) — déconnexion multi-appareils', () => {
  it('401 — un jeton sans tv est refusé, sans consulter la base', async () => {
    const legacyToken = app.jwt.sign({ userId: 'uuid-test-user', email: 'alice@example.com' })

    const res = await getUser({ authorization: `Bearer ${legacyToken}` })

    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBe('TOKEN_REVOKED')
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('401 — jeton avec un tv qui ne correspond plus à celui en base', async () => {
    const staleToken = app.jwt.sign({ userId: 'uuid-test-user', email: 'alice@example.com', tv: 0 })
    mockPrisma.user.findUnique.mockResolvedValue({ tokenVersion: 1 })

    const res = await getUser({ authorization: `Bearer ${staleToken}` })

    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBe('TOKEN_REVOKED')
  })

  it('200 — jeton avec un tv à jour', async () => {
    const validToken = app.jwt.sign({ userId: 'uuid-test-user', email: 'alice@example.com', tv: 1 })
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'uuid-test-user', tokenVersion: 1, emailEncrypted: encryptEmail('alice@example.com'), createdAt: new Date(),
    })

    const res = await getUser({ authorization: `Bearer ${validToken}` })

    expect(res.statusCode).toBe(200)
  })
})

describe('PUT /api/user/password', () => {
  const changePassword = (payload: any, headers: Record<string, string> = {}) =>
    app.inject({ method: 'PUT', url: '/api/user/password', payload, headers })

  const STRONG_PASSWORD = 'Tirelire_Abyss-99'

  it('200 — change le mot de passe, ré-émet la session (cookie) et un jeton CSRF', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'uuid-test-user', tokenVersion: 0,
      emailEncrypted: encryptEmail('alice@example.com'),
      passwordHash: await bcrypt.hash('old-password', 4),
    })
    mockPrisma.user.update.mockResolvedValue({ tokenVersion: 1 })

    const res = await changePassword(
      { currentPassword: 'old-password', newPassword: STRONG_PASSWORD },
      { authorization: `Bearer ${token}` },
    )

    expect(res.statusCode).toBe(200)
    expect(res.json().token).toBeUndefined() // plus jamais dans le corps de la réponse
    expect(typeof res.json().csrfToken).toBe('string')
    const cookie = res.cookies.find((c: any) => c.name === 'token')
    expect(cookie?.value.split('.')).toHaveLength(3) // un JWT, tout neuf
    expect(mockPrisma.user.update.mock.calls[0][0].data.tokenVersion).toEqual({ increment: 1 })
  })

  it('400 — nouveau mot de passe sous le niveau requis', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'uuid-test-user', tokenVersion: 0, emailEncrypted: encryptEmail('alice@example.com'),
      passwordHash: await bcrypt.hash('old-password', 4),
    })

    const res = await changePassword(
      { currentPassword: 'old-password', newPassword: 'Bonjour42' },
      { authorization: `Bearer ${token}` },
    )

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('WEAK_PASSWORD')
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it('un nouveau mot de passe identique à l\'ancien reste signalé SAME_PASSWORD, pas WEAK_PASSWORD (même s\'il est faible)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'uuid-test-user', tokenVersion: 0, emailEncrypted: encryptEmail('alice@example.com'),
      passwordHash: await bcrypt.hash('Bonjour42', 4),
    })

    const res = await changePassword(
      { currentPassword: 'Bonjour42', newPassword: 'Bonjour42' },
      { authorization: `Bearer ${token}` },
    )

    expect(res.json().code).toBe('SAME_PASSWORD')
  })

  it('401 — mot de passe actuel incorrect', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'uuid-test-user', tokenVersion: 0, emailEncrypted: encryptEmail('alice@example.com'),
      passwordHash: await bcrypt.hash('old-password', 4),
    })

    const res = await changePassword(
      { currentPassword: 'wrong', newPassword: 'new-password-123' },
      { authorization: `Bearer ${token}` },
    )

    expect(res.statusCode).toBe(401)
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it('400 — nouveau mot de passe identique à l\'ancien', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'uuid-test-user', tokenVersion: 0, emailEncrypted: encryptEmail('alice@example.com'),
      passwordHash: await bcrypt.hash('same-password', 4),
    })

    const res = await changePassword(
      { currentPassword: 'same-password', newPassword: 'same-password' },
      { authorization: `Bearer ${token}` },
    )

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('SAME_PASSWORD')
  })

  it('401 — sans token', async () => {
    const res = await changePassword({ currentPassword: 'a', newPassword: 'newpassword' })
    expect(res.statusCode).toBe(401)
  })
})

