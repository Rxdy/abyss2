/**
 * Tests page — DataPage (Profil → Mes données)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DataPage from '@/pages/DataPage.vue'
import { useAuthStore } from '@/stores/auth.store.js'

beforeEach(() => {
  vi.unstubAllGlobals()
  useAuthStore().setSession({ csrfToken: 'csrf-abc', user: { id: 'u1', email: 'alice@example.com' } })
})

const button = (w, label) => w.findAll('button').find((b) => b.text().includes(label))

describe('DataPage', () => {
  it('regroupe export, réinitialisation et suppression du compte', () => {
    const w = mount(DataPage)

    expect(button(w, 'Tout exporter (JSON)')).toBeTruthy()
    expect(button(w, 'Transactions (CSV)')).toBeTruthy()
    expect(button(w, 'Réinitialiser mes données')).toBeTruthy()
    expect(button(w, 'Supprimer mon compte')).toBeTruthy()
  })

  it('télécharge le format choisi', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, blob: async () => new Blob(['x']) })
    vi.stubGlobal('fetch', fetchMock)
    URL.createObjectURL = vi.fn(() => 'blob:fake')
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    const w = mount(DataPage)
    await button(w, 'Transactions (CSV)').trigger('click')
    await flushPromises()

    expect(fetchMock.mock.calls.at(-1)[0]).toMatch(/\/api\/user\/export\?format=csv$/)
    expect(click).toHaveBeenCalledOnce()
    click.mockRestore()
  })

  it('affiche l\'erreur si l\'export échoue', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: 'Erreur serveur.' }) }))

    const w = mount(DataPage)
    await button(w, 'Tout exporter (JSON)').trigger('click')
    await flushPromises()

    expect(w.find('[role="alert"]').text()).toContain('Erreur serveur.')
  })
})
