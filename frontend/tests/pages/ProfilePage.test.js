/**
 * Tests page — ProfilePage (c'est ici qu'on se déconnecte)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ProfilePage from '@/pages/ProfilePage.vue'
import { useAuthStore } from '@/stores/auth.store.js'
import { router } from '../setup.js'

const PROFILE = {
  id: '97f57bbc-aaa6-4e6e-833a-4f1ce55473e9',
  email: 'alice@example.com',
  createdAt: '2026-01-15T10:00:00.000Z',
}

function mockFetch(body, { ok = true, status = 200 } = {}) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, status, json: async () => body })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  vi.unstubAllGlobals()
  useAuthStore().setSession({ token: 'jwt', user: { id: PROFILE.id, email: PROFILE.email } })
})

describe('ProfilePage — affichage', () => {
  it('charge le profil depuis l\'API avec le token', async () => {
    const fetchMock = mockFetch(PROFILE)

    mount(ProfilePage)
    await flushPromises()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/user$/)
    expect(options.headers.Authorization).toBe('Bearer jwt')
  })

  it('affiche email, date de création et identifiant', async () => {
    mockFetch(PROFILE)

    const w = mount(ProfilePage)
    await flushPromises()

    expect(w.text()).toContain('alice@example.com')
    expect(w.text()).toContain('15 janvier 2026')
    expect(w.text()).toContain(PROFILE.id)
  })

  it('retombe sur les infos du store si l\'API échoue', async () => {
    mockFetch({ error: 'Token manquant ou invalide.' }, { ok: false, status: 401 })

    const w = mount(ProfilePage)
    await flushPromises()

    expect(w.find('[role="alert"]').text()).toContain('Token manquant ou invalide.')
    expect(w.text()).toContain('alice@example.com')
  })
})

describe('ProfilePage — déconnexion', () => {
  it('propose un bouton de déconnexion', async () => {
    mockFetch(PROFILE)

    const w = mount(ProfilePage)
    await flushPromises()

    expect(w.find('.profile__logout').text()).toContain('Se déconnecter')
  })

  it('vide la session au clic', async () => {
    mockFetch(PROFILE)
    const auth = useAuthStore()

    const w = mount(ProfilePage)
    await flushPromises()
    await w.find('.profile__logout').trigger('click')

    expect(auth.isAuthenticated).toBe(false)
    expect(auth.token).toBeNull()
    expect(sessionStorage.getItem('abyss2_token')).toBeNull()
  })

  it('renvoie vers la page de connexion', async () => {
    mockFetch(PROFILE)
    const push = vi.spyOn(router, 'push')

    const w = mount(ProfilePage)
    await flushPromises()
    await w.find('.profile__logout').trigger('click')

    expect(push).toHaveBeenCalledWith({ name: 'login' })
  })
})
