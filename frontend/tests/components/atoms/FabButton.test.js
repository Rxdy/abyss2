/**
 * Tests composant — FabButton
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FabButton from '@/components/atoms/FabButton.vue'

describe('FabButton', () => {
  it('est un bouton nommé, avec une icône décorative', () => {
    const w = mount(FabButton, { props: { label: 'Ajouter une transaction' } })

    expect(w.element.tagName).toBe('BUTTON')
    expect(w.attributes('type')).toBe('button')
    expect(w.attributes('aria-label')).toBe('Ajouter une transaction')
    expect(w.find('svg').attributes('aria-hidden')).toBe('true')
    expect(w.text()).toBe('')
  })

  it('laisse passer le clic au parent', async () => {
    let clicked = 0
    const w = mount(FabButton, { props: { label: 'Ajouter' }, attrs: { onClick: () => { clicked++ } } })

    await w.trigger('click')

    expect(clicked).toBe(1)
  })
})
