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
  useAuthStore().setSession({ csrfToken: 'csrf-abc', user: { id: PROFILE.id, email: PROFILE.email } })
})

describe('ProfilePage — affichage', () => {
  it('charge le profil depuis l\'API via le cookie de session', async () => {
    const fetchMock = mockFetch(PROFILE)

    mount(ProfilePage)
    await flushPromises()

    const [, options] = fetchMock.mock.calls.find(([url]) => /\/api\/user$/.test(url))
    expect(options.credentials).toBe('include')
  })

  it('mène à la gestion du compte et aux préférences', async () => {
    mockFetch(PROFILE)

    const w = mount(ProfilePage)
    await flushPromises()

    const links = w.findAll('a').map((a) => a.attributes('href'))
    expect(links).toContain('/profile/account')
    expect(links).toContain('/profile/preferences')
  })

  it('mène à Mes données et au Support par une seule entrée chacun, sans gros boutons sur la page', async () => {
    mockFetch(PROFILE)

    const w = mount(ProfilePage)
    await flushPromises()

    const links = w.findAll('a').map((a) => a.attributes('href'))
    expect(links).toContain('/profile/data')
    expect(links.filter((href) => href.startsWith('/profile/support'))).toEqual(['/profile/support'])
    expect(w.text()).not.toContain('Tout exporter')
    expect(w.text()).not.toContain('Supprimer mon compte')
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
    await flushPromises()

    expect(auth.isAuthenticated).toBe(false)
    expect(auth.csrfToken).toBeNull()
    expect(localStorage.getItem('abyss2_has_session')).toBeNull()
  })

  it('renvoie vers la page de connexion', async () => {
    mockFetch(PROFILE)
    const push = vi.spyOn(router, 'push')

    const w = mount(ProfilePage)
    await flushPromises()
    await w.find('.profile__logout').trigger('click')
    await flushPromises()

    expect(push).toHaveBeenCalledWith({ name: 'login' })
  })
})
