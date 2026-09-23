/**
 * Tests composant — ColorPicker
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ColorPicker from '@/components/molecules/ColorPicker.vue'
import { CATEGORY_COLORS } from '@/utils/palette.js'

const mountPicker = (props = {}) => mount(ColorPicker, { props: { modelValue: CATEGORY_COLORS[1], ...props } })

describe('ColorPicker', () => {
  it('propose la palette complète et un sélecteur libre', () => {
    const w = mountPicker()

    expect(w.findAll('button')).toHaveLength(CATEGORY_COLORS.length)
    expect(w.find('input[type="color"]').exists()).toBe(true)
  })

  it('marque la couleur courante comme sélectionnée', () => {
    const w = mountPicker()
    const pressed = w.findAll('button').filter((b) => b.attributes('aria-pressed') === 'true')

    expect(pressed).toHaveLength(1)
    expect(pressed[0].attributes('aria-label')).toBe(`Couleur ${CATEGORY_COLORS[1]}`)
  })

  it('émet la couleur cliquée (v-model)', async () => {
    const w = mountPicker()

    await w.findAll('button')[3].trigger('click')

    expect(w.emitted('update:modelValue')[0]).toEqual([CATEGORY_COLORS[3]])
  })

  it('émet la couleur du sélecteur libre', async () => {
    const w = mountPicker()

    await w.find('input[type="color"]').setValue('#123456')

    expect(w.emitted('update:modelValue')[0]).toEqual(['#123456'])
  })

  it('la palette est nommée par son libellé (groupe accessible)', () => {
    const w = mountPicker({ label: 'Teinte' })
    const group = w.find('[role="group"]')

    expect(w.text()).toContain('Teinte')
    expect(w.find(`#${group.attributes('aria-labelledby')}`).text()).toBe('Teinte')
  })

  it('accepte une palette personnalisée', () => {
    const w = mountPicker({ palette: ['#000000', '#ffffff'], modelValue: '#000000' })

    expect(w.findAll('button')).toHaveLength(2)
  })
})
