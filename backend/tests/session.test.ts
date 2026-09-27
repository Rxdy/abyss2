/**
 * Tests — modes de session et renouvellement glissant (utils/session.ts, fastify.authenticate)
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { buildApp } from '../src/app.js'

beforeAll(() => {
  process.env.MASTER_SECRET = 'b'.repeat(64)
  process.env.JWT_SECRET    = 'test-jwt-secret'
})

const { shouldRenew, sessionCookieOptions } = await import('../src/utils/session.js')
const { encryptEmail } = await import('../src/utils/crypto.js')

const USER_ID = '11111111-1111-1111-1111-111111111111'
const NOW = Date.UTC(2026, 8, 23, 12, 0, 0)
const secondsAgo = (s: number) => NOW / 1000 - s

describe('shouldRenew', () => {
  it('« rester connecté » : renouvelle après ~5 jours (1/6 de 30 jours), pas avant', () => {
    expect(shouldRenew(secondsAgo(4 * 24 * 3600), 'persistent', NOW)).toBe(false)
    expect(shouldRenew(secondsAgo(6 * 24 * 3600), 'persistent', NOW)).toBe(true)
  })

  it('« connexion à chaque session » : renouvelle après 5 minutes', () => {
    expect(shouldRenew(secondsAgo(4 * 60), 'strict', NOW)).toBe(false)
    expect(shouldRenew(secondsAgo(6 * 60), 'strict', NOW)).toBe(true)
  })

  it('sans date d\'émission : ne renouvelle pas', () => {
    expect(shouldRenew(undefined, 'strict', NOW)).toBe(false)
  })

  it('mode inconnu : traité comme « rester connecté »', () => {
    expect(sessionCookieOptions('bizarre')).toMatchObject({ maxAge: 30 * 24 * 60 * 60 })
    expect(sessionCookieOptions('strict')).not.toHaveProperty('maxAge')
  })
})

describe('authenticate — renouvellement glissant', () => {
  let app: any
  let mockPrisma: any

  beforeEach(async () => {
    mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: USER_ID, tokenVersion: 0, sessionMode: 'strict',
          emailEncrypted: encryptEmail('alice@example.com'), createdAt: new Date(), currency: 'EUR',
        }),
      },
      $disconnect: vi.fn(),
      $queryRaw: vi.fn().mockResolvedValue([]),
    }
    app = await buildApp({ testing: true, prisma: mockPrisma })
    await app.ready()
  })

  afterEach(async () => { if (app) await app.close() })

  const sign = (ageSeconds: number) =>
    app.jwt.sign({ userId: USER_ID, email: 'alice@example.com', tv: 0, iat: Math.floor(Date.now() / 1000) - ageSeconds })
  const viaCookie = (token: string) => app.inject({ method: 'GET', url: '/api/user', cookies: { token } })
  const renewed = (res: any) => res.cookies.find((c: any) => c.name === 'token')

  it('jeton porté par cookie, assez ancien : ré-émis à pleine durée, selon le mode du compte', async () => {
    const res = await viaCookie(sign(10 * 60))

    expect(res.statusCode).toBe(200)
    const cookie = renewed(res)
    expect(cookie).toBeDefined()
    expect(cookie.maxAge).toBeUndefined() // mode strict : toujours un cookie de session
    const decoded: any = app.jwt.verify(cookie.value)
    expect(decoded.exp - decoded.iat).toBe(30 * 60)
    expect(decoded).toMatchObject({ userId: USER_ID, email: 'alice@example.com', tv: 0 })
  })

  it('jeton récent : pas de ré-émission à chaque requête', async () => {
    const res = await viaCookie(sign(60))
    expect(renewed(res)).toBeUndefined()
  })

  it('client Bearer : jamais de cookie posé', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/user', headers: { authorization: `Bearer ${sign(10 * 60)}` } })
    expect(res.statusCode).toBe(200)
    expect(renewed(res)).toBeUndefined()
  })

  it('jeton révoqué : 401, rien de ré-émis', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ tokenVersion: 3, sessionMode: 'persistent' })

    const res = await viaCookie(sign(10 * 60))

    expect(res.statusCode).toBe(401)
    expect(res.json().code).toBe('TOKEN_REVOKED')
    expect(renewed(res)).toBeUndefined()
  })
})
