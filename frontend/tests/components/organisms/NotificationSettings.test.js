/**
 * Tests composant — NotificationSettings (types de notification, page Profil)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import NotificationSettings from '@/components/organisms/NotificationSettings.vue'
import { useAuthStore } from '@/stores/auth.store.js'
import { mockApi, calls } from '../../stores/_helpers.js'

const SETTINGS = { envelopeOverspend: true, negativeBalance: false, uncategorizedDigest: true }

const switches = (w) => w.findAll('input[role="switch"]')

beforeEach(() => {
  vi.unstubAllGlobals()
  useAuthStore().setSession({ csrfToken: 'csrf-abc', user: { id: 'u1', email: 'alice@example.com' } })
})

describe('NotificationSettings', () => {
  it('charge les réglages et affiche un interrupteur par type, libellé compris', async () => {
    mockApi(() => ({ body: SETTINGS }))
    const w = mount(NotificationSettings)
    await flushPromises()

    expect(switches(w).map((s) => s.element.checked)).toEqual([true, false, true])
    expect(w.find('label[for="notify-negativeBalance"]').text()).toContain('Solde négatif')
  })

  it('basculer envoie seulement ce réglage', async () => {
    const fetchMock = mockApi(({ method, body }) => ({ body: method === 'PUT' ? { ...SETTINGS, ...body } : SETTINGS }))
    const w = mount(NotificationSettings)
    await flushPromises()

    await switches(w)[1].setValue(true)
    await flushPromises()

    const put = calls(fetchMock).find((c) => c.method === 'PUT')
    expect(put).toEqual({ method: 'PUT', path: '/api/user/notification-settings', body: { negativeBalance: true } })
    expect(switches(w)[1].element.checked).toBe(true)
  })

  it('refus de l\'API : revient à l\'état précédent et affiche l\'erreur', async () => {
    mockApi(({ method }) => (method === 'PUT'
      ? { ok: false, status: 500, body: { error: 'Enregistrement impossible.' } }
      : { body: SETTINGS }))
    const w = mount(NotificationSettings)
    await flushPromises()

    await switches(w)[0].setValue(false)
    await flushPromises()

    expect(switches(w)[0].element.checked).toBe(true)
    expect(w.text()).toContain('Enregistrement impossible.')
  })

  it('tant que les réglages ne sont pas chargés : interrupteurs désactivés', async () => {
    mockApi(() => ({ ok: false, status: 500, body: { error: 'boom' } }))
    const w = mount(NotificationSettings)
    await flushPromises()

    expect(switches(w).every((s) => s.element.disabled)).toBe(true)
    expect(w.text()).toContain('boom')
  })
})
