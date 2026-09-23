/**
 * Tests composant — IconButton
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import IconButton from '@/components/atoms/IconButton.vue'

describe('IconButton', () => {
  it('porte un nom accessible même sans texte visible', () => {
    const w = mount(IconButton, { props: { label: 'Supprimer' }, slots: { default: '<i />' } })

    expect(w.attributes('aria-label')).toBe('Supprimer')
    expect(w.text()).toBe('')
  })

  it('est un bouton de type "button" (ne soumet jamais un formulaire)', () => {
    expect(mount(IconButton, { props: { label: 'x' } }).attributes('type')).toBe('button')
  })

  it('applique la variante demandée', () => {
    expect(mount(IconButton, { props: { label: 'x' } }).classes()).toContain('icon-btn--plain')
    expect(mount(IconButton, { props: { label: 'x', variant: 'outline' } }).classes()).toContain('icon-btn--outline')
    expect(mount(IconButton, { props: { label: 'x', variant: 'accent' } }).classes()).toContain('icon-btn--accent')
  })

  it('signale une action destructive', () => {
    expect(mount(IconButton, { props: { label: 'x', danger: true } }).classes()).toContain('icon-btn--danger')
  })

  it('transmet clic et état désactivé', async () => {
    let clicks = 0
    const enabled  = mount(IconButton, { props: { label: 'x' }, attrs: { onClick: () => clicks++ } })
    const disabled = mount(IconButton, { props: { label: 'x' }, attrs: { disabled: true } })

    await enabled.trigger('click')

    expect(clicks).toBe(1)
    expect(disabled.attributes('disabled')).toBeDefined()
  })
})
