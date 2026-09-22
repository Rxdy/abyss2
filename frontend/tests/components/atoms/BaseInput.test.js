/**
 * Tests composant — BaseInput
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseInput from '@/components/atoms/BaseInput.vue'

describe('BaseInput', () => {
  it('affiche le label si fourni', () => {
    const w = mount(BaseInput, { props: { label: 'Email', id: 'inp-email' } })
    expect(w.find('label').text()).toContain('Email')
  })

  it('n\'affiche pas de label si absent', () => {
    const w = mount(BaseInput, { props: { id: 'inp-test' } })
    expect(w.find('label').exists()).toBe(false)
  })

  it('hideLabel garde le label (accessibilité) mais le rend invisible', () => {
    const w = mount(BaseInput, { props: { label: 'Rechercher', hideLabel: true, id: 'inp-hidden' } })
    expect(w.find('label').text()).toContain('Rechercher')
    expect(w.find('label').classes()).toContain('field__label--hidden')
  })

  it('transmet min et max à l\'input (bornes d\'une plage de dates)', () => {
    const w = mount(BaseInput, { props: { type: 'date', min: '2026-01-01', max: '2026-12-31' } })
    expect(w.find('input').attributes('min')).toBe('2026-01-01')
    expect(w.find('input').attributes('max')).toBe('2026-12-31')
  })

  it('size sm applique la variante compacte, md par défaut', () => {
    expect(mount(BaseInput).find('input').classes()).toContain('field__input--md')
    expect(mount(BaseInput, { props: { size: 'sm' } }).find('input').classes()).toContain('field__input--sm')
  })

  it('lie le label à l\'input via for/id', () => {
    const w = mount(BaseInput, { props: { label: 'Email', id: 'inp-a11y' } })
    expect(w.find('label').attributes('for')).toBe('inp-a11y')
    expect(w.find('input').attributes('id')).toBe('inp-a11y')
  })

  it('affiche une étoile si required', () => {
    const w = mount(BaseInput, { props: { label: 'Email', required: true, id: 'inp-req' } })
    expect(w.find('.field__required').exists()).toBe(true)
  })

  it('émet update:modelValue à la saisie', async () => {
    const w = mount(BaseInput, { props: { modelValue: '', id: 'inp-emit' } })
    await w.find('input').setValue('test@example.com')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['test@example.com'])
  })

  it('affiche le message d\'erreur et la classe --error', () => {
    const w = mount(BaseInput, { props: { id: 'inp-err', error: 'Champ requis' } })
    expect(w.find('.field').classes()).toContain('field--error')
    expect(w.find('[role="alert"]').text()).toBe('Champ requis')
  })

  it('marque l\'input aria-invalid en erreur', () => {
    const w = mount(BaseInput, { props: { id: 'inp-invalid', error: 'Champ requis' } })
    expect(w.find('input').attributes('aria-invalid')).toBe('true')
    expect(w.find('input').attributes('aria-describedby')).toBe('inp-invalid-error')
  })

  it('affiche le hint quand il n\'y a pas d\'erreur', () => {
    const w = mount(BaseInput, { props: { id: 'inp-hint', hint: '8 caractères minimum' } })
    expect(w.find('.field__message--hint').text()).toBe('8 caractères minimum')
  })

  it('l\'erreur prend le pas sur le hint', () => {
    const w = mount(BaseInput, {
      props: { id: 'inp-both', hint: 'un indice', error: 'une erreur' },
    })
    expect(w.find('.field__message--hint').exists()).toBe(false)
    expect(w.find('.field__message--error').text()).toBe('une erreur')
  })

  it('n\'affiche pas d\'œil sur un champ texte', () => {
    const w = mount(BaseInput, { props: { id: 'inp-text', type: 'text' } })
    expect(w.find('.field__eye').exists()).toBe(false)
  })

  it('bascule le type du champ mot de passe au clic sur l\'œil', async () => {
    const w = mount(BaseInput, { props: { id: 'inp-pwd', type: 'password' } })

    expect(w.find('input').attributes('type')).toBe('password')
    await w.find('.field__eye').trigger('click')
    expect(w.find('input').attributes('type')).toBe('text')
    await w.find('.field__eye').trigger('click')
    expect(w.find('input').attributes('type')).toBe('password')
  })

  it('désactive l\'input et applique la classe --disabled', () => {
    const w = mount(BaseInput, { props: { id: 'inp-off', disabled: true } })
    expect(w.find('input').attributes('disabled')).toBeDefined()
    expect(w.find('.field').classes()).toContain('field--disabled')
  })
})
