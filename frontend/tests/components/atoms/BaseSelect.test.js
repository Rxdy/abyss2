/**
 * Tests composant — BaseSelect
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseSelect from '@/components/atoms/BaseSelect.vue'

const options = '<option value="">Aucune</option><option value="a">Alimentation</option><option value="b">Transport</option>'

function make(props = {}, attrs = {}) {
  return mount(BaseSelect, { props: { id: 'cat', ...props }, attrs, slots: { default: options } })
}

describe('BaseSelect', () => {
  it('affiche les options fournies', () => {
    expect(make().findAll('option').map((o) => o.text())).toEqual(['Aucune', 'Alimentation', 'Transport'])
  })

  it('reflète la valeur du v-model', () => {
    expect(make({ modelValue: 'b' }).find('select').element.value).toBe('b')
  })

  it('émet la nouvelle valeur au changement', async () => {
    const w = make({ modelValue: '' })

    await w.find('select').setValue('a')

    expect(w.emitted('update:modelValue')[0]).toEqual(['a'])
  })

  it('associe le libellé au champ', () => {
    const w = make({ label: 'Catégorie' })

    expect(w.find('label').attributes('for')).toBe('cat')
    expect(w.find('select').attributes('id')).toBe('cat')
  })

  it('signale l\'erreur avec role="alert" et aria-invalid', () => {
    const w = make({ error: 'Choix requis' })

    expect(w.find('select').attributes('aria-invalid')).toBe('true')
    expect(w.find('[role="alert"]').text()).toBe('Choix requis')
    expect(w.find('select').attributes('aria-describedby')).toBe('cat-error')
  })

  it('affiche l\'indication quand il n\'y a pas d\'erreur', () => {
    const w = make({ hint: 'Facultatif' })

    expect(w.text()).toContain('Facultatif')
    expect(w.find('select').attributes('aria-describedby')).toBe('cat-hint')
  })

  it('applique les attributs (aria-label…) sur le <select> lui-même', () => {
    const w = make({}, { 'aria-label': 'Mois' })

    expect(w.find('select').attributes('aria-label')).toBe('Mois')
  })

  it('peut être désactivé', () => {
    expect(make({ disabled: true }).find('select').attributes('disabled')).toBeDefined()
  })
})
