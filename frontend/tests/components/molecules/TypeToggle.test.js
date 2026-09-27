/**
 * Tests composant — TypeToggle
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TypeToggle from '@/components/molecules/TypeToggle.vue'

describe('TypeToggle', () => {
  it('propose Dépense et Revenu, le type courant étant pressé', () => {
    const buttons = mount(TypeToggle, { props: { modelValue: 'income' } }).findAll('button')

    expect(buttons.map((b) => b.text())).toEqual(['Dépense', 'Revenu'])
    expect(buttons.map((b) => b.attributes('aria-pressed'))).toEqual(['false', 'true'])
  })

  it('émet le type choisi', async () => {
    const w = mount(TypeToggle, { props: { modelValue: 'expense' } })

    await w.findAll('button')[1].trigger('click')

    expect(w.emitted('update:modelValue')[0]).toEqual(['income'])
  })

  it('regroupe les boutons sous un libellé accessible', () => {
    const group = mount(TypeToggle, { props: { ariaLabel: 'Type de transaction' } }).find('[role="group"]')

    expect(group.attributes('aria-label')).toBe('Type de transaction')
  })
})
