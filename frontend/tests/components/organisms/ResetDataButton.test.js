/**
 * Tests composant — ResetDataButton (réinitialisation des données du compte)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ResetDataButton from '@/components/organisms/ResetDataButton.vue'
import { router } from '../../setup.js'

function mockFetch(body, { ok = true, status = 200 } = {}) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, status, json: async () => body })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

let wrapper

const mountButton = () => (wrapper = mount(ResetDataButton, { attachTo: document.body }))
const dialog = () => document.body.querySelector('[role="alertdialog"]')
const dialogButton = (label) => [...dialog().querySelectorAll('button')].find((b) => b.textContent.includes(label))
const confirmInput = () => dialog().querySelector('#reset-data-confirm')

async function open() {
  await wrapper.find('button').trigger('click')
}

function typeConfirm(value) {
  confirmInput().value = value
  confirmInput().dispatchEvent(new Event('input'))
}

beforeEach(() => {
  vi.unstubAllGlobals()
  vi.spyOn(router, 'push').mockResolvedValue()
  vi.spyOn(window.location, 'reload').mockImplementation(() => {})
})

afterEach(() => wrapper?.unmount())

describe('ResetDataButton', () => {
  it('au repos : un simple bouton, pas de boîte de dialogue', () => {
    mountButton()

    expect(wrapper.text()).toBe('Réinitialiser mes données')
    expect(dialog()).toBeNull()
  })

  it('la confirmation explique ce qui est conservé', async () => {
    mountButton()

    await open()

    expect(dialog().textContent).toContain('irréversible')
    expect(dialog().textContent).toContain('compte et votre mot de passe restent inchangés')
  })

  it('Annuler referme la boîte sans rien appeler', async () => {
    const fetchMock = mockFetch({ reset: true })
    mountButton()
    await open()

    dialogButton('Annuler').click()
    await flushPromises()

    expect(dialog()).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuse de réinitialiser si le mot tapé ne correspond pas', async () => {
    const fetchMock = mockFetch({ reset: true })
    mountButton()
    await open()

    typeConfirm('nimporte quoi')
    dialogButton('Réinitialiser').click()
    await flushPromises()

    expect(dialog().textContent).toContain('Tapez « RÉINITIALISER » pour confirmer.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('réinitialise quand le mot est correct (insensible à la casse et aux espaces), puis recharge', async () => {
    const fetchMock = mockFetch({ reset: true })
    mountButton()
    await open()

    typeConfirm('  réinitialiser  ')
    dialogButton('Réinitialiser').click()
    await flushPromises()

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/user\/data$/)
    expect(options.method).toBe('DELETE')
    expect(router.push).toHaveBeenCalledWith('/')
    expect(dialog()).toBeNull()
  })

  it('affiche l\'erreur de l\'API sans recharger', async () => {
    mockFetch({ error: 'Erreur serveur.' }, { ok: false, status: 500 })
    mountButton()
    await open()

    typeConfirm('RÉINITIALISER')
    dialogButton('Réinitialiser').click()
    await flushPromises()

    expect(dialog().textContent).toContain('Erreur serveur.')
    expect(router.push).not.toHaveBeenCalled()
  })
})
