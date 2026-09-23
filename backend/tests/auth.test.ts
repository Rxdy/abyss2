/**
 * Tests d'intégration — routes /api/auth
 *
 * Utilise buildApp() avec un Prisma mocké pour isoler les tests
 * de la vraie base de données.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import bcrypt from 'bcryptjs'
import { buildApp } from '../src/app.js'

beforeAll(() => {
  process.env.MASTER_SECRET = 'b'.repeat(64)
  process.env.JWT_SECRET    = 'test-jwt-secret'
})

const { hashEmail, encryptEmail } = await import('../src/utils/crypto.js')

/** Atteint le niveau « Fort » requis à l'inscription (voir utils/passwordStrength.ts). */
const STRONG_PASSWORD = 'Tirelire_Abyss-99'

/** Utilisateur tel que le renverrait Prisma. */
async function makeFakeUser(email: string, password: string) {
  return {
    id:             'uuid-test-user',
    emailEncrypted: encryptEmail(email),
    passwordHash:   await bcrypt.hash(password, 4), // rounds faibles = tests rapides
  }
}

let app: any
let mockPrisma: any

beforeEach(async () => {
  mockPrisma = {
    user: { findUnique: vi.fn(), create: vi.fn() },
    // register amorce les catégories par défaut du nouveau compte
    category: { createMany: vi.fn().mockResolvedValue({ count: 8 }) },
    $disconnect: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([]),
  }
  app = await buildApp({ testing: true, prisma: mockPrisma })
  await app.ready()
})

afterEach(async () => {
  if (app) await app.close()
})

const register = (payload: unknown) =>
  app.inject({ method: 'POST', url: '/api/auth/register', payload })

const login = (payload: unknown) =>
  app.inject({ method: 'POST', url: '/api/auth/login', payload })

/** Jeton de session posé en cookie httpOnly par la réponse (voir utils/session.ts). */
const sessionCookie = (res: any) => res.cookies.find((c: any) => c.name === 'token')?.value

// ── POST /api/auth/register ───────────────────────────────────
describe('POST /api/auth/register', () => {
  it('201 — crée le compte avec un email et un mot de passe valides', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({
      id: 'new-uuid',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    })

    const res = await register({ email: 'alice@example.com', password: STRONG_PASSWORD })

    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ id: 'new-uuid', email: 'alice@example.com' })
  })

  it('stocke le blind index et l\'email chiffré, jamais l\'email en clair', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({ id: 'new-uuid', createdAt: new Date() })

    await register({ email: 'alice@example.com', password: STRONG_PASSWORD })

    const { data } = mockPrisma.user.create.mock.calls[0][0]
    expect(data.emailHash).toBe(hashEmail('alice@example.com'))
    expect(data.emailEncrypted).not.toContain('alice@example.com')
    expect(JSON.stringify(data)).not.toContain('alice@example.com')
    expect(JSON.stringify(data)).not.toContain(STRONG_PASSWORD)
  })

  it('n\'écrit que les colonnes qu\'il exploite (pas de sel ni de fragment de clé inutilisés)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({ id: 'new-uuid', createdAt: new Date() })

    await register({ email: 'alice@example.com', password: STRONG_PASSWORD })

    const { data } = mockPrisma.user.create.mock.calls[0][0]
    expect(Object.keys(data).sort()).toEqual(['emailEncrypted', 'emailHash', 'passwordHash'])
  })

  it('hache le mot de passe avec bcrypt', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({ id: 'new-uuid', createdAt: new Date() })

    await register({ email: 'alice@example.com', password: STRONG_PASSWORD })

    const { data } = mockPrisma.user.create.mock.calls[0][0]
    expect(data.passwordHash).toMatch(/^\$2[aby]\$/)
    expect(await bcrypt.compare(STRONG_PASSWORD, data.passwordHash)).toBe(true)
  })

  it('normalise la casse de l\'email', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({ id: 'new-uuid', createdAt: new Date() })

    const res = await register({ email: 'Alice@Example.COM', password: STRONG_PASSWORD })

    expect(res.json().email).toBe('alice@example.com')
    expect(mockPrisma.user.create.mock.calls[0][0].data.emailHash)
      .toBe(hashEmail('alice@example.com'))
  })

  // Le schéma Fastify (format: 'email') s'applique avant le handler : les espaces
  // parasites sont rejetés, pas rognés. C'est au front de trimmer avant l'envoi.
  it('400 — email entouré d\'espaces', async () => {
    const res = await register({ email: '  alice@example.com ', password: STRONG_PASSWORD })
    expect(res.statusCode).toBe(400)
  })

  it('409 — email déjà utilisé', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' })

    const res = await register({ email: 'alice@example.com', password: STRONG_PASSWORD })

    expect(res.statusCode).toBe(409)
    expect(res.json().code).toBe('EMAIL_ALREADY_EXISTS')
    expect(mockPrisma.user.create).not.toHaveBeenCalled()
  })

  it('400 — mot de passe trop court', async () => {
    const res = await register({ email: 'alice@example.com', password: 'court' })
    expect(res.statusCode).toBe(400)
  })

  it('400 — email invalide', async () => {
    const res = await register({ email: 'pas-un-email', password: STRONG_PASSWORD })
    expect(res.statusCode).toBe(400)
  })

  it('400 — champ manquant', async () => {
    const res = await register({ email: 'alice@example.com' })
    expect(res.statusCode).toBe(400)
  })

  it('amorce les catégories par défaut du nouveau compte', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({ id: 'new-uuid', createdAt: new Date() })

    await register({ email: 'alice@example.com', password: STRONG_PASSWORD })

    const { data } = mockPrisma.category.createMany.mock.calls[0][0]
    expect(data.length).toBeGreaterThan(0)
    expect(data.every((category: any) => category.userId === 'new-uuid')).toBe(true)
    // Les libellés partent chiffrés, comme le reste
    expect(JSON.stringify(data)).not.toContain('Alimentation')
  })
})

// ── POST /api/auth/login ──────────────────────────────────────
describe('POST /api/auth/register — mot de passe', () => {
  it('400 — au-delà de 72 caractères (bcrypt ignore la suite)', async () => {
    const res = await register({ email: 'alice@example.com', password: 'a'.repeat(73) })

    expect(res.statusCode).toBe(400)
    expect(mockPrisma.user.create).not.toHaveBeenCalled()
  })

  it('400 — mot de passe sous le niveau requis, même valide en longueur (8-72)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const res = await register({ email: 'alice@example.com', password: 'Bonjour42' })

    expect(res.statusCode).toBe(400)
    expect(res.json().code).toBe('WEAK_PASSWORD')
    expect(res.json().error).toContain('le niveau « Fort » est requis')
    expect(mockPrisma.user.create).not.toHaveBeenCalled()
  })

  it('400 — mot de passe faible : ne consulte même pas l\'unicité de l\'email (échoue avant la requête)', async () => {
    await register({ email: 'alice@example.com', password: 'Bonjour42' })

    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('201 — le même mot de passe fort qu\'utilise le compte de démo (make seed) passe', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({ id: 'new-uuid', createdAt: new Date() })

    const res = await register({ email: 'alice@example.com', password: STRONG_PASSWORD })

    expect(res.statusCode).toBe(201)
  })
})

describe('POST /api/auth/login', () => {
  it('200 — pose la session en cookie httpOnly, renvoie l\'utilisateur et un jeton CSRF', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      await makeFakeUser('alice@example.com', 'password123')
    )

    const res = await login({ email: 'alice@example.com', password: 'password123' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.token).toBeUndefined() // plus jamais dans le corps de la réponse
    expect(body.user).toEqual({ id: 'uuid-test-user', email: 'alice@example.com' })
    expect(typeof body.csrfToken).toBe('string')
    expect(body.csrfToken.length).toBeGreaterThan(0)

    expect(sessionCookie(res)?.split('.')).toHaveLength(3) // un JWT

    const cookie = res.cookies.find((c: any) => c.name === 'token')
    expect(cookie).toMatchObject({ httpOnly: true, path: '/', sameSite: 'Lax' })
    // Pas de `Secure` en développement : un navigateur refuserait le cookie sur http://localhost.
    expect(cookie?.secure).toBeFalsy()
  })

  it('cherche l\'utilisateur par blind index, pas par email en clair', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      await makeFakeUser('alice@example.com', 'password123')
    )

    await login({ email: 'alice@example.com', password: 'password123' })

    const { where } = mockPrisma.user.findUnique.mock.calls[0][0]
    expect(where).toEqual({ emailHash: hashEmail('alice@example.com') })
  })

  it('le JWT porte userId et email déchiffré', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      await makeFakeUser('alice@example.com', 'password123')
    )

    const res = await login({ email: 'alice@example.com', password: 'password123' })
    const decoded: any = app.jwt.verify(sessionCookie(res))

    expect(decoded.userId).toBe('uuid-test-user')
    expect(decoded.email).toBe('alice@example.com')
    expect(decoded.exp - decoded.iat).toBe(7 * 24 * 60 * 60) // 7 jours
  })

  it('401 — email inconnu', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const res = await login({ email: 'inconnu@example.com', password: 'password123' })

    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBe('INVALID_CREDENTIALS')
  })

  it('401 — email inconnu : fait quand même un bcrypt.compare (temps de réponse constant)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const compare = vi.spyOn(bcrypt, 'compare')

    const res = await login({ email: 'inconnu@example.com', password: 'password123' })

    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBe('INVALID_CREDENTIALS')
    expect(compare).toHaveBeenCalledOnce()
  })

  it('401 — mauvais mot de passe', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      await makeFakeUser('alice@example.com', 'password123')
    )

    const res = await login({ email: 'alice@example.com', password: 'mauvais' })

    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBe('INVALID_CREDENTIALS')
  })

  it('renvoie le même message pour email inconnu et mauvais mot de passe', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const unknown = await login({ email: 'inconnu@example.com', password: 'password123' })

    mockPrisma.user.findUnique.mockResolvedValue(
      await makeFakeUser('alice@example.com', 'password123')
    )
    const wrongPassword = await login({ email: 'alice@example.com', password: 'mauvais' })

    expect(unknown.json()).toEqual(wrongPassword.json())
  })

  it('ne renvoie jamais le hash du mot de passe', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      await makeFakeUser('alice@example.com', 'password123')
    )

    const res = await login({ email: 'alice@example.com', password: 'password123' })

    expect(res.body).not.toContain('$2a$')
    expect(res.body).not.toContain('password123')
  })

  it('400 — email invalide', async () => {
    const res = await login({ email: 'pas-un-email', password: 'password123' })
    expect(res.statusCode).toBe(400)
  })
})
