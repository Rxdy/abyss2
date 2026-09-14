/**
 * Tests composant — BaseButton
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseButton from '@/components/atoms/BaseButton.vue'

describe('BaseButton', () => {
  it('rend le contenu du slot', () => {
    const w = mount(BaseButton, { slots: { default: 'Se connecter' } })
    expect(w.text()).toBe('Se connecter')
  })

  it('applique variant et size par défaut', () => {
    const w = mount(BaseButton)
    expect(w.classes()).toContain('btn--primary')
    expect(w.classes()).toContain('btn--md')
  })

  it('applique les classes variant/size demandées', () => {
    const w = mount(BaseButton, { props: { variant: 'danger', size: 'lg' } })
    expect(w.classes()).toEqual(expect.arrayContaining(['btn--danger', 'btn--lg']))
  })

  it('type button par défaut, submit si demandé', () => {
    expect(mount(BaseButton).attributes('type')).toBe('button')
    expect(mount(BaseButton, { props: { type: 'submit' } }).attributes('type')).toBe('submit')
  })

  it('émet click', async () => {
    const w = mount(BaseButton)
    await w.trigger('click')
    expect(w.emitted('click')).toHaveLength(1)
  })

  it('n\'émet pas click quand disabled', async () => {
    const w = mount(BaseButton, { props: { disabled: true } })
    await w.trigger('click')
    expect(w.emitted('click')).toBeUndefined()
  })

  it('affiche un spinner et se désactive en loading', async () => {
    const w = mount(BaseButton, { props: { loading: true } })

    expect(w.find('.btn__spinner').exists()).toBe(true)
    expect(w.attributes('disabled')).toBeDefined()
    expect(w.classes()).toContain('btn--loading')

    await w.trigger('click')
    expect(w.emitted('click')).toBeUndefined()
  })

  it('prend toute la largeur avec full', () => {
    expect(mount(BaseButton, { props: { full: true } }).classes()).toContain('btn--full')
  })
})
