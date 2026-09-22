/**
 * Tests page — RegisterPage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import RegisterPage from '@/pages/RegisterPage.vue'
import { useAuthStore } from '@/stores/auth.store.js'
import { router } from '../setup.js'

/** Une réponse par appel fetch, dans l'ordre. */
function mockFetchSequence(...responses) {
  const fetchMock = vi.fn()
  for (const { body, ok = true, status = 200 } of responses) {
    fetchMock.mockResolvedValueOnce({ ok, status, json: async () => body })
  }
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function fill(w, { email = 'alice@example.com', password = 'Vélo-Bleu_4821', confirm = password } = {}) {
  await w.find('#register-email').setValue(email)
  await w.find('#register-password').setValue(password)
  await w.find('#register-confirm').setValue(confirm)
}

async function submit(w) {
  await w.find('form').trigger('submit')
  await flushPromises()
}

const CREATED  = { body: { id: '1', email: 'alice@example.com' }, status: 201 }
const SESSION  = { body: { csrfToken: 'csrf-abc', user: { id: '1', email: 'alice@example.com' } } }

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('RegisterPage — rendu', () => {
  it('affiche les trois champs et le bouton', () => {
    const w = mount(RegisterPage)

    expect(w.find('#register-email').exists()).toBe(true)
    expect(w.find('#register-password').attributes('type')).toBe('password')
    expect(w.find('#register-confirm').attributes('type')).toBe('password')
    expect(w.find('button[type="submit"]').text()).toContain('Créer mon compte')
    expect(w.find('button[type="submit"]').classes()).toContain('btn--primary')
  })

  it('renvoie vers la connexion', () => {
    expect(mount(RegisterPage).find('a[href="/login"]').exists()).toBe(true)
  })

  it('affiche la barre de robustesse dès le départ, vide, sans texte', () => {
    const w = mount(RegisterPage)

    expect(w.find('[role="meter"]').exists()).toBe(true)
    expect(w.findAll('.meter__segment')).toHaveLength(5)
    expect(w.findAll('.meter__segment--on')).toHaveLength(0)
    expect(w.find('.meter__bar').text()).toBe('')
  })

  it('la barre suit la saisie : segments allumés, libellé en infobulle au survol', async () => {
    const w = mount(RegisterPage)

    await w.find('#register-password').setValue('Bonjour42')
    expect(w.find('.meter__tip').text()).toBe('Très faible')
    expect(w.findAll('.meter__segment--on')).toHaveLength(1)

    await w.find('#register-password').setValue('Zx9!Qw8@Er7#')
    expect(w.find('.meter__tip').text()).toBe('Fort')
    expect(w.findAll('.meter__segment--on')).toHaveLength(4)
  })
})

describe('RegisterPage — validation', () => {
  it('refuse un formulaire vide sans appeler l\'API', async () => {
    const fetchMock = mockFetchSequence()
    const w = mount(RegisterPage)

    await submit(w)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(w.text()).toContain('L\'adresse email est requise.')
    expect(w.text()).toContain('au moins 8 caractères')
  })

  it('refuse un email mal formé', async () => {
    const fetchMock = mockFetchSequence()
    const w = mount(RegisterPage)

    await fill(w, { email: 'pas-un-email' })
    await submit(w)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(w.text()).toContain('n\'est pas valide')
  })

  it('refuse un mot de passe de moins de 8 caractères', async () => {
    const fetchMock = mockFetchSequence()
    const w = mount(RegisterPage)

    await fill(w, { password: 'court1' })
    await submit(w)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(w.text()).toContain('au moins 8 caractères')
  })

  it('refuse un mot de passe de plus de 72 caractères', async () => {
    const fetchMock = mockFetchSequence()
    const w = mount(RegisterPage)

    await fill(w, { password: 'a'.repeat(73) })
    await submit(w)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(w.text()).toContain('72 caractères')
  })

  it('refuse un mot de passe sous le niveau requis, en disant lequel et pourquoi', async () => {
    const fetchMock = mockFetchSequence()
    const w = mount(RegisterPage)

    await fill(w, { password: 'Bonjour42' })
    await submit(w)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(w.text()).toContain('Mot de passe trop faible (« Très faible »')
    expect(w.text()).toContain('le niveau « Fort » est requis')
  })

  it('refuse un mot de passe « Moyen » : la barre est à « Fort »', async () => {
    const fetchMock = mockFetchSequence()
    const w = mount(RegisterPage)

    await fill(w, { password: 'Zx9!Qw8@' })
    await submit(w)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(w.text()).toContain('« Moyen »')
  })

  it('accepte un mot de passe qui atteint tout juste le niveau requis', async () => {
    const fetchMock = mockFetchSequence(CREATED, SESSION)
    const w = mount(RegisterPage)

    await fill(w, { password: 'Zx9!Qw8@Er' })
    await submit(w)

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('refuse deux mots de passe différents', async () => {
    const fetchMock = mockFetchSequence()
    const w = mount(RegisterPage)

    await fill(w, { password: 'Vélo-Bleu_4821', confirm: 'Vélo-Bleu_4822' })
    await submit(w)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(w.text()).toContain('ne correspondent pas')
  })
})

describe('RegisterPage — inscription réussie', () => {
  it('crée le compte puis ouvre la session', async () => {
    const fetchMock = mockFetchSequence(CREATED, SESSION)
    const w = mount(RegisterPage)

    await fill(w, { email: '  Alice@Example.COM  ' })
    await submit(w)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/auth\/register$/)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: 'alice@example.com',
      password: 'Vélo-Bleu_4821',
    })
    expect(fetchMock.mock.calls[1][0]).toMatch(/\/api\/auth\/login$/)

    const auth = useAuthStore()
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.csrfToken).toBe('csrf-abc')
  })

  it('redirige vers l\'accueil', async () => {
    mockFetchSequence(CREATED, SESSION)
    const push = vi.spyOn(router, 'push')
    const w = mount(RegisterPage)

    await fill(w)
    await submit(w)

    expect(push).toHaveBeenCalledWith({ name: 'home' })
  })
})

describe('RegisterPage — échec', () => {
  it('affiche l\'erreur de l\'API (email déjà pris) sans ouvrir de session', async () => {
    const fetchMock = mockFetchSequence({ body: { error: 'Cette adresse email est déjà utilisée.' }, ok: false, status: 409 })
    const push = vi.spyOn(router, 'push')
    const w = mount(RegisterPage)

    await fill(w)
    await submit(w)

    expect(w.find('[role="alert"]').text()).toContain('déjà utilisée')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(useAuthStore().isAuthenticated).toBe(false)
    expect(push).not.toHaveBeenCalled()
  })
})
