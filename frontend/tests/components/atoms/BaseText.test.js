/**
 * Tests composant — BaseText
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseText from '@/components/atoms/BaseText.vue'

describe('BaseText', () => {
  it('rend un span par défaut', () => {
    const w = mount(BaseText, { slots: { default: 'Bonjour' } })
    expect(w.element.tagName).toBe('SPAN')
    expect(w.text()).toBe('Bonjour')
  })

  it('rend la balise demandée', () => {
    expect(mount(BaseText, { props: { as: 'h1' } }).element.tagName).toBe('H1')
    expect(mount(BaseText, { props: { as: 'p' } }).element.tagName).toBe('P')
  })

  it('applique les classes size/color/weight', () => {
    const w = mount(BaseText, { props: { size: '2xl', color: 'danger', weight: 'bold' } })
    expect(w.classes()).toEqual(
      expect.arrayContaining(['text--2xl', 'text--danger', 'text--bold'])
    )
  })

  it('applique les modificateurs mono et truncate', () => {
    const w = mount(BaseText, { props: { mono: true, truncate: true } })
    expect(w.classes()).toEqual(expect.arrayContaining(['text--mono', 'text--truncate']))
  })

  it('utilise inherit/base/normal par défaut', () => {
    const w = mount(BaseText)
    expect(w.classes()).toEqual(
      expect.arrayContaining(['text--base', 'text--inherit', 'text--normal'])
    )
  })
})
