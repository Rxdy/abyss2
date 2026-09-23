/**
 * Tests composant — AppHeader
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AppHeader from '@/components/organisms/AppHeader.vue'
import { useAuthStore } from '@/stores/auth.store.js'
import { listenForInstall, resetPwaInstall } from '@/composables/usePwaInstall.js'
import { router } from '../../setup.js'

beforeEach(async () => {
  await router.push('/')
  await router.isReady()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  useAuthStore().setSession({ csrfToken: 'csrf-abc', user: { id: '1', email: 'alice@example.com' } })
})

describe('AppHeader — contenu', () => {
  it('affiche la marque', () => {
    expect(mount(AppHeader).text()).toContain('ABYSS2')
  })

  it('n\'affiche pas l\'email de l\'utilisateur', () => {
    const w = mount(AppHeader)
    expect(w.text()).not.toContain('alice@example.com')
  })

  it('porte la navigation principale', () => {
    const w = mount(AppHeader)

    const nav = w.find('nav[aria-label="Navigation principale"]')
    expect(nav.exists()).toBe(true)
    expect(nav.findAll('a')).toHaveLength(5)
  })

  it('propose la bascule de thème', () => {
    expect(mount(AppHeader).find('.theme-toggle').exists()).toBe(true)
  })

  it('n\'affiche pas le bouton d\'installation quand la PWA n\'est pas installable', () => {
    resetPwaInstall()
    expect(mount(AppHeader).find('.pwa-install').exists()).toBe(false)
  })

  it('affiche le bouton d\'installation dès que le navigateur le permet', async () => {
    resetPwaInstall()
    listenForInstall()
    const w = mount(AppHeader)

    const event = new Event('beforeinstallprompt', { cancelable: true })
    event.prompt = vi.fn()
    event.userChoice = Promise.resolve({ outcome: 'dismissed' })
    window.dispatchEvent(event)
    await w.vm.$nextTick()

    expect(w.find('.pwa-install').exists()).toBe(true)
  })
})

describe('AppHeader — déconnexion', () => {
  it('expose un bouton de déconnexion étiqueté', () => {
    const button = mount(AppHeader).find('.app-header__logout')

    expect(button.exists()).toBe(true)
    expect(button.attributes('aria-label')).toBe('Se déconnecter')
  })

  it('vide la session au clic', async () => {
    const auth = useAuthStore()
    const w = mount(AppHeader)

    await w.find('.app-header__logout').trigger('click')
    await flushPromises()

    expect(auth.isAuthenticated).toBe(false)
    expect(localStorage.getItem('abyss2_has_session')).toBeNull()
  })

  it('renvoie vers la page de connexion', async () => {
    const push = vi.spyOn(router, 'push')
    const w = mount(AppHeader)

    await w.find('.app-header__logout').trigger('click')
    await flushPromises()

    expect(push).toHaveBeenCalledWith({ name: 'login' })
  })
})
