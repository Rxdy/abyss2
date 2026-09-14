/**
 * Tests composable — useApi
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useApi } from '@/composables/useApi.js'
import { useAuthStore } from '@/stores/auth.store.js'

function mockFetch(body, { ok = true, status = 200 } = {}) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('useApi', () => {
  it('GET — préfixe l\'URL de base et renvoie le JSON', async () => {
    const fetchMock = mockFetch({ status: 'ok' })
    const api = useApi()

    const data = await api.get('/health')

    expect(data).toEqual({ status: 'ok' })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/health$/)
    expect(options.method).toBe('GET')
  })

  it('POST — sérialise le corps et pose le Content-Type', async () => {
    const fetchMock = mockFetch({ token: 'jwt' })
    const api = useApi()

    await api.post('/api/auth/login', { email: 'a@b.c', password: 'x' })

    const [, options] = fetchMock.mock.calls[0]
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual({ email: 'a@b.c', password: 'x' })
  })

  it('ajoute le header Authorization quand un token est présent', async () => {
    useAuthStore().setSession({ token: 'jwt-token', user: null })
    const fetchMock = mockFetch({ ok: true })

    await useApi().get('/api/user')

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer jwt-token')
  })

  it('n\'ajoute pas Authorization sans token', async () => {
    const fetchMock = mockFetch({ ok: true })

    await useApi().get('/health')

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })

  it('rejette avec le message d\'erreur de l\'API', async () => {
    mockFetch({ error: 'Email ou mot de passe incorrect.' }, { ok: false, status: 401 })
    const api = useApi()

    await expect(api.post('/api/auth/login', {}))
      .rejects.toThrow('Email ou mot de passe incorrect.')
    expect(api.error.value).toBe('Email ou mot de passe incorrect.')
  })

  it('retombe sur le code HTTP si l\'API ne donne pas de message', async () => {
    mockFetch({}, { ok: false, status: 500 })

    await expect(useApi().get('/boom')).rejects.toThrow('HTTP 500')
  })

  it('remet loading à false même en cas d\'échec', async () => {
    mockFetch({ error: 'boom' }, { ok: false, status: 500 })
    const api = useApi()

    await expect(api.get('/boom')).rejects.toThrow()
    expect(api.loading.value).toBe(false)
  })

  it('propage une panne réseau', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')))

    await expect(useApi().get('/health')).rejects.toThrow('Failed to fetch')
  })

  it('expose put et del avec les bonnes méthodes', async () => {
    const fetchMock = mockFetch({})
    const api = useApi()

    await api.put('/api/user', { a: 1 })
    await api.del('/api/user')

    expect(fetchMock.mock.calls[0][1].method).toBe('PUT')
    expect(fetchMock.mock.calls[1][1].method).toBe('DELETE')
  })
})
