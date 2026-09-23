/**
 * Tests composant — CoinDropIcon
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CoinDropIcon from '@/components/atoms/CoinDropIcon.vue'

describe('CoinDropIcon', () => {
  it('rend un svg décoratif à la taille par défaut', () => {
    const w = mount(CoinDropIcon)

    const svg = w.find('svg')
    expect(svg.attributes('width')).toBe('64')
    expect(svg.attributes('height')).toBe('64')
    expect(svg.attributes('aria-hidden')).toBe('true')
  })

  it('respecte la taille demandée', () => {
    const w = mount(CoinDropIcon, { props: { size: 32 } })

    expect(w.find('svg').attributes('width')).toBe('32')
  })

  it('la pièce qui tombe est isolée dans son propre groupe', () => {
    const w = mount(CoinDropIcon)

    expect(w.find('.coin-drop__coin').exists()).toBe(true)
  })
})
