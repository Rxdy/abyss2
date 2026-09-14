/**
 * Tests page — HomePage (tableau de bord des services)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import HomePage from '@/pages/HomePage.vue'
import { useAuthStore } from '@/stores/auth.store.js'

/** Répond selon l'URL appelée. */
function mockApi({ health = { status: 'ok' }, db = { status: 'connected', schema: 'dbo' } } = {}) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
    const body = url.includes('/api/db-status') ? db : health
    return Promise.resolve({ ok: true, status: 200, json: async () => body })
  }))
}

function mockServiceWorker(registration) {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { getRegistration: vi.fn().mockResolvedValue(registration) },
  })
}

beforeEach(() => {
  vi.unstubAllGlobals()
  mockServiceWorker({ scope: '/' })
})

describe('HomePage', () => {
  it('affiche l\'email de l\'utilisateur connecté', async () => {
    useAuthStore().setSession({ token: 'jwt', user: { id: '1', email: 'alice@example.com' } })
    mockApi()

    const w = mount(HomePage)
    await flushPromises()

    expect(w.text()).toContain('alice@example.com')
  })

  it('liste les trois services suivis', () => {
    mockApi()
    const w = mount(HomePage)

    expect(w.findAll('.service-card')).toHaveLength(3)
    expect(w.text()).toContain('API Fastify')
    expect(w.text()).toContain('PostgreSQL')
    expect(w.text()).toContain('Service Worker')
  })

  it('passe les services au vert quand tout répond', async () => {
    mockApi()
    const w = mount(HomePage)
    await flushPromises()

    expect(w.findAll('.service-card__dot--ok')).toHaveLength(3)
    expect(w.text()).toContain('connected · schéma dbo')
  })

  it('signale l\'API en rouge quand elle échoue', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')))

    const w = mount(HomePage)
    await flushPromises()

    expect(w.findAll('.service-card__dot--ko').length).toBeGreaterThanOrEqual(2)
    expect(w.text()).toContain('Failed to fetch')
  })

  it('signale l\'absence de service worker', async () => {
    mockApi()
    mockServiceWorker(undefined)

    const w = mount(HomePage)
    await flushPromises()

    expect(w.text()).toContain('aucun service worker actif')
  })
})
