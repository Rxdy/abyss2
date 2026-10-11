/**
 * Tests composant — BaseTextarea
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseTextarea from '@/components/atoms/BaseTextarea.vue'

describe('BaseTextarea', () => {
  it('relie le libellé au champ et émet la saisie', async () => {
    const w = mount(BaseTextarea, { props: { id: 'msg', label: 'Message' } })

    expect(w.find('label').attributes('for')).toBe('msg')
    await w.find('textarea').setValue('Bonjour')
    expect(w.emitted('update:modelValue')[0]).toEqual(['Bonjour'])
  })

  it('affiche l\'erreur à la place de l\'aide', () => {
    const w = mount(BaseTextarea, { props: { hint: 'Aide', error: 'Requis.' } })

    expect(w.text()).toContain('Requis.')
    expect(w.text()).not.toContain('Aide')
    expect(w.find('textarea').attributes('aria-invalid')).toBe('true')
  })

  it('montre le compteur seulement près de la limite', async () => {
    const w = mount(BaseTextarea, { props: { maxlength: 100, modelValue: 'x'.repeat(50) } })
    expect(w.text()).not.toContain('/ 100')

    await w.setProps({ modelValue: 'x'.repeat(85) })
    expect(w.text()).toContain('85 / 100')
  })
})
