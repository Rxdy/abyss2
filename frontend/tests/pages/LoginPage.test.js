/**
 * Tests page — LoginPage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import LoginPage from '@/pages/LoginPage.vue'
import { useAuthStore } from '@/stores/auth.store.js'
import { router } from '../setup.js'

function mockFetch(body, { ok = true, status = 200 } = {}) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, status, json: async () => body })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function fillAndSubmit(w, email, password) {
  await w.find('#login-email').setValue(email)
  await w.find('#login-password').setValue(password)
  await w.find('form').trigger('submit')
  await flushPromises()
}

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('LoginPage — rendu', () => {
  it('affiche les deux champs et le bouton', () => {
    const w = mount(LoginPage)

    expect(w.find('#login-email').exists()).toBe(true)
    expect(w.find('#login-password').exists()).toBe(true)
    expect(w.find('button[type="submit"]').text()).toContain('Se connecter')
  })

  it('masque le mot de passe par défaut', () => {
    const w = mount(LoginPage)
    expect(w.find('#login-password').attributes('type')).toBe('password')
  })

  it('propose le basculement de thème', () => {
    const w = mount(LoginPage)
    expect(w.find('.theme-toggle').exists()).toBe(true)
  })

  it('propose de créer un compte', () => {
    const link = mount(LoginPage).find('a[href="/register"]')

    expect(link.exists()).toBe(true)
    expect(link.text()).toBe('Créer un compte')
  })

  it('n\'affiche aucune erreur au chargement', () => {
    const w = mount(LoginPage)
    expect(w.find('[role="alert"]').exists()).toBe(false)
  })
})

describe('LoginPage — validation', () => {
  it('refuse un formulaire vide sans appeler l\'API', async () => {
    const fetchMock = mockFetch({})
    const w = mount(LoginPage)

    await w.find('form').trigger('submit')
    await flushPromises()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(w.text()).toContain('L\'adresse email est requise.')
    expect(w.text()).toContain('Le mot de passe est requis.')
  })

  it('signale le seul champ manquant', async () => {
    const fetchMock = mockFetch({})
    const w = mount(LoginPage)

    await w.find('#login-email').setValue('alice@example.com')
    await w.find('form').trigger('submit')
    await flushPromises()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(w.text()).toContain('Le mot de passe est requis.')
    expect(w.text()).not.toContain('L\'adresse email est requise.')
  })
})

describe('LoginPage — connexion réussie', () => {
  it('envoie l\'email normalisé à l\'API', async () => {
    const fetchMock = mockFetch({ csrfToken: 'csrf-abc', user: { id: '1', email: 'alice@example.com' } })
    const w = mount(LoginPage)

    await fillAndSubmit(w, '  Alice@Example.COM  ', 'password123')

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/auth\/login$/)
    expect(JSON.parse(options.body)).toEqual({
      email: 'alice@example.com',
      password: 'password123',
    })
  })

  it('enregistre la session dans le store', async () => {
    mockFetch({ csrfToken: 'csrf-abc', user: { id: '1', email: 'alice@example.com' } })
    const w = mount(LoginPage)

    await fillAndSubmit(w, 'alice@example.com', 'password123')

    const auth = useAuthStore()
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.csrfToken).toBe('csrf-abc')
    expect(auth.user.email).toBe('alice@example.com')
  })

  it('redirige vers l\'accueil', async () => {
    mockFetch({ csrfToken: 'csrf-abc', user: { id: '1', email: 'alice@example.com' } })
    const push = vi.spyOn(router, 'push')
    const w = mount(LoginPage)

    await fillAndSubmit(w, 'alice@example.com', 'password123')

    expect(push).toHaveBeenCalledWith({ name: 'home' })
  })
})

describe('LoginPage — échec', () => {
  it('affiche le message d\'erreur de l\'API', async () => {
    mockFetch({ error: 'Email ou mot de passe incorrect.' }, { ok: false, status: 401 })
    const w = mount(LoginPage)

    await fillAndSubmit(w, 'alice@example.com', 'mauvais')

    expect(w.find('[role="alert"]').text()).toContain('Email ou mot de passe incorrect.')
  })

  it('ne connecte pas et ne redirige pas', async () => {
    mockFetch({ error: 'Email ou mot de passe incorrect.' }, { ok: false, status: 401 })
    const push = vi.spyOn(router, 'push')
    const w = mount(LoginPage)

    await fillAndSubmit(w, 'alice@example.com', 'mauvais')

    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(push).not.toHaveBeenCalled()
  })

  it('affiche un message en cas de panne réseau', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')))
    const w = mount(LoginPage)

    await fillAndSubmit(w, 'alice@example.com', 'password123')

    expect(w.find('[role="alert"]').exists()).toBe(true)
  })

  it('libère le bouton après l\'échec', async () => {
    mockFetch({ error: 'boom' }, { ok: false, status: 500 })
    const w = mount(LoginPage)

    await fillAndSubmit(w, 'alice@example.com', 'password123')

    expect(w.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })
})
