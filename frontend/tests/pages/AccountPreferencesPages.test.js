/**
 * Tests pages — Gestion du compte et Préférences (sous-pages du Profil)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AccountPage     from '@/pages/AccountPage.vue'
import PreferencesPage from '@/pages/PreferencesPage.vue'
import { useAuthStore } from '@/stores/auth.store.js'
import { mockApi } from '../stores/_helpers.js'

beforeEach(() => {
  vi.unstubAllGlobals()
  useAuthStore().setSession({ csrfToken: 'csrf', user: { id: 'u1', email: 'alice@example.com', currency: 'EUR' } })
})

describe('AccountPage', () => {
  it('montre l\'adresse actuelle et les deux formulaires, sans bouton Annuler', () => {
    const w = mount(AccountPage)

    expect(w.text()).toContain('alice@example.com')
    expect(w.findComponent({ name: 'EmailChangeForm' }).exists()).toBe(true)
    expect(w.findComponent({ name: 'PasswordChangeForm' }).exists()).toBe(true)
    expect(w.findAll('button').some((b) => b.text() === 'Annuler')).toBe(false)
  })
})

describe('PreferencesPage', () => {
  it('regroupe thème, devise, session et notifications', async () => {
    mockApi(() => ({ body: { envelopeOverspend: true, negativeBalance: true, uncategorizedDigest: true } }))
    const w = mount(PreferencesPage)
    await flushPromises()

    expect(w.findComponent({ name: 'ThemeSettings' }).exists()).toBe(true)
    expect(w.findComponent({ name: 'CurrencySettings' }).exists()).toBe(true)
    expect(w.findComponent({ name: 'NotificationSettings' }).exists()).toBe(true)
    expect(w.findComponent({ name: 'SessionSettings' }).exists()).toBe(true)
  })
})
