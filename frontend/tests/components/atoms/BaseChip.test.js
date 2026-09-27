/**
 * Tests composant — BaseChip
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseChip from '@/components/atoms/BaseChip.vue'

describe('BaseChip', () => {
  it('affiche son contenu dans un bouton', () => {
    const w = mount(BaseChip, { slots: { default: 'Dépenses' } })

    expect(w.element.tagName).toBe('BUTTON')
    expect(w.attributes('type')).toBe('button')
    expect(w.text()).toBe('Dépenses')
  })

  it('expose son état aux lecteurs d\'écran (aria-pressed)', () => {
    expect(mount(BaseChip, { props: { active: true } }).attributes('aria-pressed')).toBe('true')
    expect(mount(BaseChip).attributes('aria-pressed')).toBe('false')
  })

  it('marque visuellement l\'état actif', () => {
    expect(mount(BaseChip, { props: { active: true } }).classes()).toContain('chip--active')
    expect(mount(BaseChip).classes()).not.toContain('chip--active')
  })

  it('propose deux formes : pilule (défaut) et bloc', () => {
    expect(mount(BaseChip).classes()).toContain('chip--pill')
    expect(mount(BaseChip, { props: { shape: 'block' } }).classes()).toContain('chip--block')
  })

  it('transmet le clic', async () => {
    let clicks = 0
    const w = mount(BaseChip, { attrs: { onClick: () => clicks++ } })

    await w.trigger('click')

    expect(clicks).toBe(1)
  })
})
