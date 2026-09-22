/**
 * Tests d'intégration — routes infra (/health, /api/db-status)
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { buildApp } from '../src/app.js'

beforeAll(() => {
  process.env.MASTER_SECRET = 'b'.repeat(64)
  process.env.JWT_SECRET    = 'test-jwt-secret'
})

let app: any
let mockPrisma: any

beforeEach(async () => {
  mockPrisma = {
    user: { findUnique: vi.fn(), create: vi.fn() },
    $disconnect: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
  }
  app = await buildApp({ testing: true, prisma: mockPrisma })
  await app.ready()
})

afterEach(async () => {
  if (app) await app.close()
})

describe('GET /health', () => {
  it('200 — répond ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)

    const body = res.json()
    expect(body.status).toBe('ok')
    expect(body.service).toBe('api')
    expect(new Date(body.timestamp).toString()).not.toBe('Invalid Date')
  })
})

describe('GET /api/db-status', () => {
  it('200 — connected quand la requête passe', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/db-status' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'connected', schema: 'dbo' })
    expect(mockPrisma.$queryRaw).toHaveBeenCalled()
  })

  it('503 — error quand PostgreSQL est injoignable', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('connection refused'))

    const res = await app.inject({ method: 'GET', url: '/api/db-status' })
    expect(res.statusCode).toBe(503)
    expect(res.json().status).toBe('error')
  })
})

describe('routes inconnues', () => {
  it('404 sur une route non déclarée', async () => {
    const res = await app.inject({ method: 'GET', url: '/nawak' })
    expect(res.statusCode).toBe(404)
  })
})

describe('démarrage en production', () => {
  it('refuse de démarrer sans JWT_SECRET (pas de secret de repli)', async () => {
    const secret = process.env.JWT_SECRET
    delete process.env.JWT_SECRET

    try {
      await expect(buildApp({ prisma: mockPrisma })).rejects.toThrow('JWT_SECRET')
    } finally {
      process.env.JWT_SECRET = secret
    }
  })
})

describe('en-têtes de sécurité', () => {
  const headers = async () => (await app.inject({ method: 'GET', url: '/health' })).headers

  it('CSP stricte : une API JSON ne charge rien et ne s\'encadre nulle part', async () => {
    const csp = String((await headers())['content-security-policy'])

    expect(csp).toContain("default-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("base-uri 'none'")
    expect(csp).toContain("form-action 'none'")
  })

  it('n\'ajoute pas les directives permissives par défaut de helmet', async () => {
    const csp = String((await headers())['content-security-policy'])

    expect(csp).not.toMatch(/script-src|style-src|img-src|upgrade-insecure-requests/)
  })

  it('garde les autres protections de helmet', async () => {
    const h = await headers()

    expect(h['x-content-type-options']).toBe('nosniff')
    expect(h['referrer-policy']).toBe('no-referrer')
    expect(h['x-frame-options']).toBe('SAMEORIGIN')
  })
})
