/**
 * Tests composant — CurrencySettings (Préférences)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CurrencySettings from '@/components/organisms/CurrencySettings.vue'
import { useAuthStore } from '@/stores/auth.store.js'
import { getCurrency, setCurrency } from '@/utils/format.js'
import { mockApi, calls } from '../../stores/_helpers.js'

beforeEach(() => {
  vi.unstubAllGlobals()
  useAuthStore().setSession({ csrfToken: 'csrf', user: { id: 'u1', email: 'alice@example.com', currency: 'EUR' } })
})
afterEach(() => setCurrency('EUR'))

describe('CurrencySettings', () => {
  it('propose les devises et affiche un aperçu dans la devise courante', () => {
    const w = mount(CurrencySettings)

    expect(w.findAll('option').map((o) => o.element.value)).toEqual(['EUR', 'USD', 'GBP', 'CHF', 'CAD'])
    expect(w.find('select').element.value).toBe('EUR')
    expect(w.text()).toContain('1 234,56 €')
  })

  it('choisir une devise : enregistrée sur le compte, appliquée partout tout de suite', async () => {
    const fetchMock = mockApi(() => ({ body: { currency: 'GBP' } }))
    const w = mount(CurrencySettings)

    await w.find('select').setValue('GBP')
    await flushPromises()

    expect(calls(fetchMock)).toEqual([{ method: 'PUT', path: '/api/user/preferences', body: { currency: 'GBP' } }])
    expect(getCurrency()).toBe('GBP')
    expect(useAuthStore().user.currency).toBe('GBP')
    expect(w.text()).toContain('£')
  })

  it('refus de l\'API : revient à la devise précédente et affiche l\'erreur', async () => {
    mockApi(() => ({ ok: false, status: 500, body: { error: 'Enregistrement impossible.' } }))
    const w = mount(CurrencySettings)

    await w.find('select').setValue('USD')
    await flushPromises()

    expect(getCurrency()).toBe('EUR')
    expect(useAuthStore().user.currency).toBe('EUR')
    expect(w.text()).toContain('Enregistrement impossible.')
  })
})
