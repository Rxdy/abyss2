/**
 * Tests d'intégration — limitation de débit sur /api/auth/login, /api/auth/register,
 * /api/auth/forgot-password et /api/auth/reset-password
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'

// bcrypt (12 tours ≈ 250 ms) rendrait 60 essais interminables : on le remplace.
vi.mock('bcryptjs', async (importOriginal) => {
  const actual: any = await importOriginal()
  return { ...actual, default: { ...actual.default, compare: vi.fn().mockResolvedValue(false) } }
})

import { buildApp } from '../src/app.js'

beforeAll(() => {
  process.env.MASTER_SECRET = 'b'.repeat(64)
  process.env.JWT_SECRET    = 'test-jwt-secret'
})

let app: any
let mockPrisma: any

beforeEach(async () => {
  delete process.env.RATE_LIMIT_DISABLED
  mockPrisma = {
    user: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
    passwordResetToken: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
    $disconnect: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([]),
  }
  app = await buildApp({ testing: true, prisma: mockPrisma })
  await app.ready()
})

afterEach(async () => {
  if (app) await app.close()
  delete process.env.RATE_LIMIT_DISABLED
  vi.unstubAllEnvs()
})

const login = (email = 'alice@example.com', ip = '10.0.0.1') =>
  app.inject({
    method: 'POST', url: '/api/auth/login', remoteAddress: ip,
    payload: { email, password: 'mauvais-mot-de-passe' },
  })

const register = (ip = '10.0.0.1') =>
  app.inject({ method: 'POST', url: '/api/auth/register', remoteAddress: ip, payload: {} })

const forgotPassword = (email = 'alice@example.com', ip = '10.0.0.1') =>
  app.inject({ method: 'POST', url: '/api/auth/forgot-password', remoteAddress: ip, payload: { email } })

const resetPassword = (ip = '10.0.0.1') =>
  app.inject({ method: 'POST', url: '/api/auth/reset-password', remoteAddress: ip, payload: { token: 'x', newPassword: 'Tirelire_Abyss-99' } })

describe('POST /api/auth/login — limite par IP + email', () => {
  it('laisse passer 10 essais, refuse le 11e avec un 429', async () => {
    for (let i = 0; i < 10; i++) {
      expect((await login()).statusCode).toBe(401)
    }

    const res = await login()

    expect(res.statusCode).toBe(429)
    expect(res.json().code).toBe('RATE_LIMITED')
    expect(res.json().error).toMatch(/Trop de tentatives — réessayez dans \d+ minutes?\./)
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
  })

  it('ne cherche même pas l\'utilisateur une fois bloqué', async () => {
    for (let i = 0; i < 10; i++) await login()
    mockPrisma.user.findUnique.mockClear()

    await login()

    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
  })

  it('bloquer un email ne bloque pas les autres comptes depuis la même IP', async () => {
    for (let i = 0; i < 11; i++) await login('alice@example.com')

    expect((await login('bob@example.com')).statusCode).toBe(401)
  })

  it('bloquer une IP ne bloque pas le même compte depuis une autre IP', async () => {
    for (let i = 0; i < 11; i++) await login('alice@example.com', '10.0.0.1')

    expect((await login('alice@example.com', '10.0.0.2')).statusCode).toBe(401)
  })

  it('l\'email est normalisé : changer la casse ne contourne pas la limite', async () => {
    for (let i = 0; i < 10; i++) await login('alice@example.com')

    expect((await login('ALICE@Example.com')).statusCode).toBe(429)
  })
})

describe('POST /api/auth/login — limite par IP', () => {
  it('balayer beaucoup d\'emails depuis une IP finit par être bloqué (60 essais)', async () => {
    for (let i = 0; i < 60; i++) {
      expect((await login(`user${i}@example.com`)).statusCode).toBe(401)
    }

    const res = await login('encore-un-autre@example.com')

    expect(res.statusCode).toBe(429)
    expect(res.json().code).toBe('RATE_LIMITED')
  })

  it('une autre IP n\'est pas touchée', async () => {
    for (let i = 0; i < 61; i++) await login(`user${i}@example.com`)

    expect((await login('quelquun@example.com', '10.0.0.9')).statusCode).toBe(401)
  })
})

describe('POST /api/auth/register', () => {
  it('laisse passer 20 requêtes par heure et par IP, refuse la 21e', async () => {
    for (let i = 0; i < 20; i++) {
      expect((await register()).statusCode).toBe(400) // corps vide : rejeté par la validation, mais compté
    }

    const res = await register()

    expect(res.statusCode).toBe(429)
    expect(res.json().code).toBe('RATE_LIMITED')
  })

  it('la limite d\'inscription est indépendante de celle de connexion', async () => {
    for (let i = 0; i < 11; i++) await login()

    expect((await register()).statusCode).toBe(400)
  })

  it('une autre IP peut s\'inscrire', async () => {
    for (let i = 0; i < 21; i++) await register('10.0.0.1')

    expect((await register('10.0.0.2')).statusCode).toBe(400)
  })
})

describe('POST /api/auth/forgot-password — limite par IP + email', () => {
  it('laisse passer 5 demandes, refuse la 6e avec un 429', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await forgotPassword()).statusCode).toBe(200)
    }

    const res = await forgotPassword()

    expect(res.statusCode).toBe(429)
    expect(res.json().code).toBe('RATE_LIMITED')
  })

  it('bloquer une adresse ne bloque pas les autres depuis la même IP', async () => {
    for (let i = 0; i < 6; i++) await forgotPassword('alice@example.com')

    expect((await forgotPassword('bob@example.com')).statusCode).toBe(200)
  })
})

describe('POST /api/auth/forgot-password — limite par IP', () => {
  it('balayer beaucoup d\'adresses depuis une IP finit par être bloqué (20 essais)', async () => {
    for (let i = 0; i < 20; i++) {
      expect((await forgotPassword(`user${i}@example.com`)).statusCode).toBe(200)
    }

    expect((await forgotPassword('encore-un-autre@example.com')).statusCode).toBe(429)
  })
})

describe('POST /api/auth/reset-password — limite par IP', () => {
  it('laisse passer 20 essais, refuse le 21e avec un 429', async () => {
    for (let i = 0; i < 20; i++) {
      expect((await resetPassword()).statusCode).toBe(400) // jeton inconnu, mais compté
    }

    const res = await resetPassword()

    expect(res.statusCode).toBe(429)
    expect(res.json().code).toBe('RATE_LIMITED')
  })

  it('une autre IP n\'est pas touchée', async () => {
    for (let i = 0; i < 21; i++) await resetPassword('10.0.0.1')

    expect((await resetPassword('10.0.0.2')).statusCode).toBe(400)
  })
})

describe('Limitation de débit — cas particuliers', () => {
  it('les autres routes ne sont pas limitées', async () => {
    for (let i = 0; i < 100; i++) {
      expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200)
    }
  })

  it('en production, le message du 429 reste lisible (seules les erreurs 5xx sont masquées)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    for (let i = 0; i < 10; i++) await login()

    const res = await login()

    expect(res.statusCode).toBe(429)
    expect(res.json().error).toContain('Trop de tentatives')
  })

  it('RATE_LIMIT_DISABLED=true coupe la limitation', async () => {
    process.env.RATE_LIMIT_DISABLED = 'true'

    for (let i = 0; i < 15; i++) {
      expect((await login()).statusCode).toBe(401)
    }
  })
})
