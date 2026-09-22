/**
 * Tests composant — DangerZone (suppression du compte)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DangerZone from '@/components/organisms/DangerZone.vue'
import { useAuthStore } from '@/stores/auth.store.js'
import { router } from '../../setup.js'

function mockFetch(body, { ok = true, status = 200 } = {}) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, status, json: async () => body })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

let wrapper

const mountZone = () => (wrapper = mount(DangerZone, { attachTo: document.body }))
// La boîte de dialogue est téléportée dans <body>.
const dialog = () => document.body.querySelector('[role="alertdialog"]')
const dialogButton = (label) => [...dialog().querySelectorAll('button')].find((b) => b.textContent.includes(label))

async function open() {
  await wrapper.findAll('button').find((b) => b.text() === 'Supprimer mon compte').trigger('click')
}

beforeEach(() => {
  vi.unstubAllGlobals()
  useAuthStore().setSession({ csrfToken: 'csrf-abc', user: { id: 'u1', email: 'alice@example.com' } })
})

afterEach(() => wrapper?.unmount())

describe('DangerZone', () => {
  it('au repos : un simple bouton, pas de boîte de dialogue', () => {
    mountZone()

    expect(wrapper.findAll('button')).toHaveLength(1)
    expect(wrapper.text()).toBe('Supprimer mon compte')
    expect(dialog()).toBeNull()
  })

  it('la confirmation explique que l\'opération est irréversible', async () => {
    mountZone()

    await open()

    expect(dialog().textContent).toContain('irréversible')
  })

  it('le bouton ouvre la confirmation, et Annuler la referme', async () => {
    mountZone()

    await open()
    expect(dialog()).not.toBeNull()

    dialogButton('Annuler').click()
    await flushPromises()
    expect(dialog()).toBeNull()
  })

  it('refuse de supprimer sans mot de passe', async () => {
    const fetchMock = mockFetch({ deleted: true })
    mountZone()
    await open()

    dialogButton('Supprimer définitivement').click()
    await flushPromises()

    expect(dialog().textContent).toContain('Le mot de passe est requis.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('supprime avec le mot de passe, vide la session et renvoie à la connexion', async () => {
    const fetchMock = mockFetch({ deleted: true })
    const push = vi.spyOn(router, 'push')
    mountZone()
    await open()

    const input = dialog().querySelector('input[type="password"]')
    input.value = 'mon-mdp'
    input.dispatchEvent(new Event('input'))
    dialogButton('Supprimer définitivement').click()
    await flushPromises()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/user$/)
    expect(options.method).toBe('DELETE')
    expect(JSON.parse(options.body)).toEqual({ password: 'mon-mdp' })
    expect(useAuthStore().csrfToken).toBeFalsy()
    expect(push).toHaveBeenCalledWith({ name: 'login' })
  })

  it('mauvais mot de passe : erreur affichée, session conservée', async () => {
    mockFetch({ error: 'Mot de passe incorrect.' }, { ok: false, status: 401 })
    mountZone()
    await open()

    const input = dialog().querySelector('input[type="password"]')
    input.value = 'faux'
    input.dispatchEvent(new Event('input'))
    dialogButton('Supprimer définitivement').click()
    await flushPromises()

    expect(dialog().textContent).toContain('Mot de passe incorrect.')
    expect(useAuthStore().csrfToken).toBe('csrf-abc')
  })
})
