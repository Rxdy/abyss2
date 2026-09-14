/**
 * Tests composant — AppNavbar (navigation principale, en bas sur mobile)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import AppNavbar from '@/components/organisms/AppNavbar.vue'
import { router } from '../../setup.js'

beforeEach(async () => {
  await router.push('/')
  await router.isReady()
})

describe('AppNavbar', () => {
  it('est une nav étiquetée pour les lecteurs d\'écran', () => {
    const w = mount(AppNavbar)

    expect(w.element.tagName).toBe('NAV')
    expect(w.attributes('aria-label')).toBe('Navigation principale')
  })

  it('propose Transactions, Accueil, Stats et Profil', () => {
    const w = mount(AppNavbar)
    const links = w.findAll('a')

    expect(links).toHaveLength(4)
    expect(links.map((l) => l.attributes('href'))).toEqual(['/transactions', '/', '/stats', '/profile'])
    expect(w.text()).toContain('Transactions')
    expect(w.text()).toContain('Accueil')
    expect(w.text()).toContain('Stats')
    expect(w.text()).toContain('Profil')
  })

  it('met en évidence l\'entrée correspondant à la route courante', async () => {
    const w = mount(AppNavbar)

    expect(w.findAll('.nav-item--active')).toHaveLength(1)
    expect(w.find('.nav-item--active').attributes('href')).toBe('/')

    await router.push('/profile')
    await w.vm.$nextTick()

    expect(w.find('.nav-item--active').attributes('href')).toBe('/profile')
  })

  it('ne contient pas d\'action de déconnexion', () => {
    const w = mount(AppNavbar)
    expect(w.text().toLowerCase()).not.toContain('déconnecter')
  })

  it('garde les libellés dans le DOM — ils sont masqués visuellement sous 1024px', () => {
    const w = mount(AppNavbar)

    // Le CSS les cache (technique sr-only) mais ils restent lus par les
    // lecteurs d'écran : les liens ne doivent jamais être des icônes muettes.
    for (const link of w.findAll('a')) {
      expect(link.find('.nav-item__label').text()).not.toBe('')
    }
  })
})
