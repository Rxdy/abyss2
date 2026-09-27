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
const { encryptEmail, hashEmail, decryptEmail } = await import('../src/utils/crypto.js')

let app: any
let mockPrisma: any
let token: string

beforeEach(async () => {
  mockPrisma = {
    user:                { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), update: vi.fn() },
    transaction:         { deleteMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    recurringTransaction: { deleteMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    envelope:            { deleteMany: vi.fn() },
    category:            { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    $disconnect: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([]),
    $transaction: vi.fn((ops: unknown[]) => Promise.all(ops)),
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

describe('DELETE /api/user/data', () => {
  const resetData = (headers: Record<string, string> = {}) =>
    app.inject({ method: 'DELETE', url: '/api/user/data', headers })

  it('200 — vide transactions, charges fixes, enveloppes et catégories, puis ré-amorce les catégories par défaut', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ tokenVersion: 0 })

    const res = await resetData({ authorization: `Bearer ${token}` })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ reset: true })

    expect(mockPrisma.transaction.deleteMany).toHaveBeenCalledWith({ where: { userId: 'uuid-test-user' } })
    expect(mockPrisma.recurringTransaction.deleteMany).toHaveBeenCalledWith({ where: { userId: 'uuid-test-user' } })
    expect(mockPrisma.envelope.deleteMany).toHaveBeenCalledWith({ where: { userId: 'uuid-test-user' } })
    expect(mockPrisma.category.deleteMany).toHaveBeenCalledWith({ where: { userId: 'uuid-test-user' } })

    const { data } = mockPrisma.category.createMany.mock.calls[0][0]
    expect(data).toHaveLength(8) // DEFAULT_CATEGORIES
    expect(data.every((c: any) => c.userId === 'uuid-test-user')).toBe(true)
  })

  it('401 — sans token, ne touche à rien', async () => {
    const res = await resetData()

    expect(res.statusCode).toBe(401)
    expect(mockPrisma.transaction.deleteMany).not.toHaveBeenCalled()
    expect(mockPrisma.category.deleteMany).not.toHaveBeenCalled()
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


describe('PUT /api/user/preferences', () => {
  const auth = () => ({ authorization: `Bearer ${token}` })

  it('200 — change la devise', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ tokenVersion: 0 })
    mockPrisma.user.update.mockResolvedValue({ currency: 'CHF' })

    const res = await app.inject({ method: 'PUT', url: '/api/user/preferences', headers: auth(), payload: { currency: 'CHF' } })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ currency: 'CHF' })
    expect(mockPrisma.user.update.mock.calls[0][0]).toMatchObject({ where: { id: 'uuid-test-user' }, data: { currency: 'CHF' } })
  })

  it.each(['JPY', 'eur', ''])('400 — devise non proposée (%s)', async (currency) => {
    mockPrisma.user.findUnique.mockResolvedValue({ tokenVersion: 0 })

    const res = await app.inject({ method: 'PUT', url: '/api/user/preferences', headers: auth(), payload: { currency } })

    expect(res.statusCode).toBe(400)
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it('GET /api/user renvoie la devise', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'uuid-test-user', tokenVersion: 0, emailEncrypted: encryptEmail('alice@example.com'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'), currency: 'GBP',
    })

    const res = await app.inject({ method: 'GET', url: '/api/user', headers: auth() })

    expect(res.json().currency).toBe('GBP')
  })
})

describe('PUT /api/user/email', () => {
  const auth = () => ({ authorization: `Bearer ${token}` })
  const change = (payload: Record<string, unknown>) =>
    app.inject({ method: 'PUT', url: '/api/user/email', headers: auth(), payload })

  async function currentUser() {
    return {
      id: 'uuid-test-user', tokenVersion: 0,
      emailHash: hashEmail('alice@example.com'),
      passwordHash: await bcrypt.hash('correct-horse', 4),
    }
  }

  it('200 — change l\'adresse (normalisée), chiffrée, et déconnecte les autres appareils', async () => {
    const user = await currentUser()
    mockPrisma.user.findUnique.mockImplementation(async ({ where }: any) => (where.id ? user : null))
    mockPrisma.user.update.mockResolvedValue({ tokenVersion: 1 })

    const res = await change({ email: '  Alice.New@Example.com ', password: 'correct-horse' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ email: 'alice.new@example.com', csrfToken: expect.any(String) })

    const { data } = mockPrisma.user.update.mock.calls[0][0]
    expect(data.emailHash).toBe(hashEmail('alice.new@example.com'))
    expect(data.emailEncrypted).not.toContain('alice')
    expect(decryptEmail(data.emailEncrypted)).toBe('alice.new@example.com')
    expect(data.tokenVersion).toEqual({ increment: 1 })
    // Nouvelle session pour cet appareil
    expect([res.headers['set-cookie']].flat().some((c) => String(c).startsWith('token='))).toBe(true)
  })

  it('401 — mauvais mot de passe : rien ne change', async () => {
    const user = await currentUser()
    mockPrisma.user.findUnique.mockImplementation(async ({ where }: any) => (where.id ? user : null))

    const res = await change({ email: 'alice.new@example.com', password: 'wrong' })

    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBe('INVALID_CREDENTIALS')
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it('409 — adresse déjà prise par un autre compte', async () => {
    const user = await currentUser()
    mockPrisma.user.findUnique.mockImplementation(async ({ where }: any) => (where.id ? user : { id: 'other' }))

    const res = await change({ email: 'bob@example.com', password: 'correct-horse' })

    expect(res.statusCode).toBe(409)
    expect(res.json().code).toBe('EMAIL_ALREADY_EXISTS')
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })

  it('409 — course perdue contre un autre compte (index unique)', async () => {
    const user = await currentUser()
    mockPrisma.user.findUnique.mockImplementation(async ({ where }: any) => (where.id ? user : null))
    mockPrisma.user.update.mockRejectedValue(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }))

    const res = await change({ email: 'bob@example.com', password: 'correct-horse' })

    expect(res.statusCode).toBe(409)
  })

  it('400 — même adresse qu\'aujourd\'hui (casse comprise)', async () => {
    const user = await currentUser()
    mockPrisma.user.findUnique.mockImplementation(async ({ where }: any) => (where.id ? user : null))

    const res = await change({ email: 'ALICE@example.com', password: 'correct-horse' })

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('SAME_EMAIL')
  })

  it('400 — adresse invalide', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(await currentUser())

    const res = await change({ email: 'pas-une-adresse', password: 'correct-horse' })

    expect(res.statusCode).toBe(400)
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })
})

describe('PUT /api/user/preferences — mode de session', () => {
  const auth = () => ({ authorization: `Bearer ${token}` })
  const put = (payload: Record<string, unknown>) => app.inject({ method: 'PUT', url: '/api/user/preferences', headers: auth(), payload })

  function currentMode(sessionMode: string) {
    mockPrisma.user.findUnique.mockResolvedValue({ tokenVersion: 0, sessionMode, emailEncrypted: encryptEmail('alice@example.com') })
  }

  it('passer en « connexion à chaque session » : déconnecte les autres appareils et ré-émet un cookie de session', async () => {
    currentMode('persistent')
    mockPrisma.user.update.mockResolvedValue({ id: 'uuid-test-user', currency: 'EUR', sessionMode: 'strict', tokenVersion: 1 })

    const res = await put({ sessionMode: 'strict' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ sessionMode: 'strict', csrfToken: expect.any(String) })
    expect(mockPrisma.user.update.mock.calls[0][0].data).toEqual({ sessionMode: 'strict', tokenVersion: { increment: 1 } })
    const cookie = res.cookies.find((c: any) => c.name === 'token')
    expect(cookie.maxAge).toBeUndefined()
    expect((app.jwt.verify(cookie.value) as any).tv).toBe(1)
  })

  it('revenir à « rester connecté » : ne déconnecte personne, cookie de 30 jours', async () => {
    currentMode('strict')
    mockPrisma.user.update.mockResolvedValue({ id: 'uuid-test-user', currency: 'EUR', sessionMode: 'persistent', tokenVersion: 0 })

    const res = await put({ sessionMode: 'persistent' })

    expect(mockPrisma.user.update.mock.calls[0][0].data).toEqual({ sessionMode: 'persistent' })
    expect(res.cookies.find((c: any) => c.name === 'token').maxAge).toBe(30 * 24 * 60 * 60)
  })

  it('même mode qu\'aujourd\'hui : rien à ré-émettre', async () => {
    currentMode('persistent')
    mockPrisma.user.update.mockResolvedValue({ id: 'uuid-test-user', currency: 'EUR', sessionMode: 'persistent', tokenVersion: 0 })

    const res = await put({ sessionMode: 'persistent' })

    expect(res.json().csrfToken).toBeUndefined()
    expect(res.cookies.find((c: any) => c.name === 'token')).toBeUndefined()
  })

  it.each([{ sessionMode: 'forever' }, {}])('400 — corps invalide (%j)', async (payload) => {
    currentMode('persistent')
    const res = await put(payload)
    expect(res.statusCode).toBe(400)
    expect(mockPrisma.user.update).not.toHaveBeenCalled()
  })
})
