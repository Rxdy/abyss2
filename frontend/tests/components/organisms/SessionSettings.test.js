/**
 * Tests composant — SessionSettings (mode de session, Préférences)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import SessionSettings from '@/components/organisms/SessionSettings.vue'
import { useAuthStore } from '@/stores/auth.store.js'
import { useToastStore } from '@/stores/toast.store.js'
import { mockApi, calls } from '../../stores/_helpers.js'

const radios = (w) => w.findAll('input[type="radio"]')

beforeEach(() => {
  vi.unstubAllGlobals()
  useAuthStore().setSession({ csrfToken: 'csrf-old', user: { id: 'u1', email: 'a@b.c', sessionMode: 'persistent' } })
})

describe('SessionSettings', () => {
  it('présente les deux modes et coche celui du compte', () => {
    const w = mount(SessionSettings)

    expect(w.text()).toContain('Rester connecté')
    expect(w.text()).toContain('Connexion à chaque session')
    expect(radios(w).map((r) => r.element.checked)).toEqual([true, false])
  })

  it('passer en connexion à chaque session : enregistré, nouvelle session CSRF, prévient des déconnexions', async () => {
    const fetchMock = mockApi(() => ({ body: { currency: 'EUR', sessionMode: 'strict', csrfToken: 'csrf-new' } }))
    const w = mount(SessionSettings)

    await radios(w)[1].setValue(true)
    await flushPromises()

    expect(calls(fetchMock)).toEqual([{ method: 'PUT', path: '/api/user/preferences', body: { sessionMode: 'strict' } }])
    const auth = useAuthStore()
    expect(auth.user.sessionMode).toBe('strict')
    expect(auth.csrfToken).toBe('csrf-new')
    expect(radios(w).map((r) => r.element.checked)).toEqual([false, true])
    expect(useToastStore().items[0].message).toContain('autres appareils ont été déconnectés')
  })

  it('refus de l\'API : reste sur le mode actuel et affiche l\'erreur', async () => {
    mockApi(() => ({ ok: false, status: 500, body: { error: 'Enregistrement impossible.' } }))
    const w = mount(SessionSettings)

    await radios(w)[1].setValue(true)
    await flushPromises()

    expect(useAuthStore().user.sessionMode).toBe('persistent')
    expect(radios(w).map((r) => r.element.checked)).toEqual([true, false])
    expect(w.text()).toContain('Enregistrement impossible.')
  })
})
