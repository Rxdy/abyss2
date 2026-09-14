/**
 * Tests composant — NavItem
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import NavItem from '@/components/molecules/NavItem.vue'
import { router } from '../../setup.js'

beforeEach(async () => {
  await router.push('/')
  await router.isReady()
})

describe('NavItem', () => {
  it('rend un lien vers la route et son libellé', () => {
    const w = mount(NavItem, { props: { to: '/profile', icon: 'user', label: 'Profil' } })

    expect(w.find('a').attributes('href')).toBe('/profile')
    expect(w.text()).toContain('Profil')
  })

  it('affiche une icône', () => {
    const w = mount(NavItem, { props: { to: '/', icon: 'home', label: 'Accueil' } })
    expect(w.find('svg').exists()).toBe(true)
  })

  it('garde le libellé accessible même masqué visuellement', () => {
    const w = mount(NavItem, { props: { to: '/', icon: 'home', label: 'Accueil' } })
    expect(w.find('.nav-item__label').text()).toBe('Accueil')
  })

  it('marque la route courante comme active', () => {
    const w = mount(NavItem, { props: { to: '/', icon: 'home', label: 'Accueil' } })

    expect(w.classes()).toContain('nav-item--active')
    expect(w.attributes('aria-current')).toBe('page')
  })

  it('ne marque pas les autres routes', () => {
    const w = mount(NavItem, { props: { to: '/profile', icon: 'user', label: 'Profil' } })

    expect(w.classes()).not.toContain('nav-item--active')
    expect(w.attributes('aria-current')).toBeUndefined()
  })

  it('suit le changement de route', async () => {
    const w = mount(NavItem, { props: { to: '/profile', icon: 'user', label: 'Profil' } })
    expect(w.classes()).not.toContain('nav-item--active')

    await router.push('/profile')
    await w.vm.$nextTick()

    expect(w.classes()).toContain('nav-item--active')
  })
})
