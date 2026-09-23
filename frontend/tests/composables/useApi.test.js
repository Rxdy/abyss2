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

  it('envoie toujours les cookies (credentials: include), même sans session connue', async () => {
    const fetchMock = mockFetch({ status: 'ok' })

    await useApi().get('/health')

    expect(fetchMock.mock.calls[0][1].credentials).toBe('include')
  })

  it('POST — sérialise le corps et pose le Content-Type', async () => {
    const fetchMock = mockFetch({ csrfToken: 'nouveau' })
    const api = useApi()

    await api.post('/api/auth/login', { email: 'a@b.c', password: 'x' })

    const [, options] = fetchMock.mock.calls[0]
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(options.body)).toEqual({ email: 'a@b.c', password: 'x' })
  })

  it('ajoute le header X-CSRF-Token sur une requête qui modifie des données, quand un jeton est connu', async () => {
    useAuthStore().setSession({ csrfToken: 'csrf-abc' })
    const fetchMock = mockFetch({ ok: true })

    await useApi().post('/api/categories', { name: 'Loisirs' })

    expect(fetchMock.mock.calls[0][1].headers['X-CSRF-Token']).toBe('csrf-abc')
  })

  it('n\'ajoute pas X-CSRF-Token sans jeton connu', async () => {
    const fetchMock = mockFetch({ ok: true })

    await useApi().post('/api/categories', { name: 'Loisirs' })

    expect(fetchMock.mock.calls[0][1].headers['X-CSRF-Token']).toBeUndefined()
  })

  it('n\'ajoute pas X-CSRF-Token sur une lecture (GET), même avec un jeton connu', async () => {
    useAuthStore().setSession({ csrfToken: 'csrf-abc' })
    const fetchMock = mockFetch({ ok: true })

    await useApi().get('/api/user')

    expect(fetchMock.mock.calls[0][1].headers['X-CSRF-Token']).toBeUndefined()
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

describe('useApi — download', () => {
  function mockFile({ ok = true, status = 200, body = null } = {}) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok, status,
      blob: async () => new Blob(['a,b']),
      json: async () => body,
    })
    vi.stubGlobal('fetch', fetchMock)
    URL.createObjectURL = vi.fn(() => 'blob:fake')
    URL.revokeObjectURL = vi.fn()
    return fetchMock
  }

  it('envoie les cookies (credentials: include), puis déclenche l\'enregistrement sous le nom voulu', async () => {
    const fetchMock = mockFile()
    const clicked = []
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      clicked.push({ href: this.href, download: this.download })
    })

    await useApi().download('/api/user/export?format=csv', 'export.csv')

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/user\/export\?format=csv$/)
    expect(options.credentials).toBe('include')
    expect(clicked).toEqual([{ href: 'blob:fake', download: 'export.csv' }])
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake')
    click.mockRestore()
  })

  it('propage le message d\'erreur de l\'API sans rien enregistrer', async () => {
    mockFile({ ok: false, status: 401, body: { error: 'Session expirée — reconnectez-vous.' } })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const api = useApi()

    await expect(api.download('/api/user/export', 'x.json')).rejects.toThrow('Session expirée')

    expect(api.error.value).toBe('Session expirée — reconnectez-vous.')
    expect(click).not.toHaveBeenCalled()
    click.mockRestore()
  })
})
