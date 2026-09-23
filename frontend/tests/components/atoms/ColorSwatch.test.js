/**
 * Tests composant — ColorSwatch
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ColorSwatch from '@/components/atoms/ColorSwatch.vue'

const props = { color: '#488efe', label: 'Couleur #488efe' }

describe('ColorSwatch — bouton', () => {
  it('est un bouton nommé, peint de la couleur', () => {
    const w = mount(ColorSwatch, { props })

    expect(w.element.tagName).toBe('BUTTON')
    expect(w.attributes('aria-label')).toBe('Couleur #488efe')
    expect(w.attributes('style')).toContain('background')
  })

  it('reflète l\'état actif via aria-pressed', () => {
    expect(mount(ColorSwatch, { props }).attributes('aria-pressed')).toBe('false')
    expect(mount(ColorSwatch, { props: { ...props, active: true } }).attributes('aria-pressed')).toBe('true')
  })

  it('émet select avec sa couleur au clic', async () => {
    const w = mount(ColorSwatch, { props })

    await w.trigger('click')

    expect(w.emitted('select')[0]).toEqual(['#488efe'])
  })
})

describe('ColorSwatch — personnalisée', () => {
  it('embarque un sélecteur natif nommé', () => {
    const w = mount(ColorSwatch, { props: { ...props, custom: true, label: 'Choisir une couleur' } })

    const input = w.find('input[type="color"]')
    expect(input.exists()).toBe(true)
    expect(input.attributes('aria-label')).toBe('Choisir une couleur')
    expect(w.find('button').exists()).toBe(false)
  })

  it('émet select avec la couleur choisie', async () => {
    const w = mount(ColorSwatch, { props: { ...props, custom: true } })

    await w.find('input').setValue('#ff0000')

    expect(w.emitted('select')[0]).toEqual(['#ff0000'])
  })
})
