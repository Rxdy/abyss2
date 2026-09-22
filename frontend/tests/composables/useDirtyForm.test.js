/**
 * Tests composable — useDirtyForm
 */

import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick, provide, ref } from 'vue'
import { FORM_MODAL_KEY, useDirtyForm } from '@/composables/useDirtyForm.js'

/** Monte le composable dans un composant (inject/provide en ont besoin). */
function setup(initial, setDirty) {
  let result
  const Child = defineComponent({
    setup() {
      const form = ref(initial)
      result = { form, ...useDirtyForm(form) }
      return () => h('div')
    },
  })
  const Parent = defineComponent({
    setup() {
      if (setDirty) provide(FORM_MODAL_KEY, { setDirty })
      return () => h(Child)
    },
  })
  mount(Parent)
  return result
}

describe('useDirtyForm', () => {
  it('propre à l\'ouverture', () => {
    expect(setup({ name: '' }).dirty.value).toBe(false)
  })

  it('devient modifié dès qu\'un champ change, y compris en profondeur', async () => {
    const { form, dirty } = setup({ name: '', tags: { a: 1 } })

    form.value.tags.a = 2
    await nextTick()

    expect(dirty.value).toBe(true)
  })

  it('redevient propre quand on revient à la valeur d\'origine', async () => {
    const { form, dirty } = setup({ name: 'Loyer' })

    form.value.name = 'Autre'
    await nextTick()
    form.value.name = 'Loyer'
    await nextTick()

    expect(dirty.value).toBe(false)
  })

  it('prévient la modale englobante, une fois au départ puis à chaque changement d\'état', async () => {
    const setDirty = vi.fn()
    const { form } = setup({ name: '' }, setDirty)
    expect(setDirty).toHaveBeenLastCalledWith(false)

    form.value.name = 'x'
    await nextTick()
    expect(setDirty).toHaveBeenLastCalledWith(true)

    form.value.name = ''
    await nextTick()
    expect(setDirty).toHaveBeenLastCalledWith(false)
  })

  it('fonctionne hors modale (rien à prévenir)', async () => {
    const { form, dirty } = setup({ name: '' })

    form.value.name = 'x'
    await nextTick()

    expect(dirty.value).toBe(true)
  })
})
