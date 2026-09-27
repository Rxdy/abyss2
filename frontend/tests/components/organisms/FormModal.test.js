/**
 * Tests composant — FormModal (modale de formulaire + confirmation d'abandon)
 */

import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import FormModal from '@/components/organisms/FormModal.vue'
import { useDirtyForm } from '@/composables/useDirtyForm.js'

// Un mini formulaire qui signale ses modifications, comme les vrais.
const Field = defineComponent({
  setup() {
    const form = ref({ name: '' })
    useDirtyForm(form)
    return () => h('input', { id: 'name', value: form.value.name, onInput: (e) => { form.value.name = e.target.value } })
  },
})

let wrapper
afterEach(() => { wrapper?.unmount(); wrapper = null; document.body.innerHTML = '' })

async function open() {
  wrapper = mount(FormModal, { props: { title: 'Saisie' }, slots: { default: () => h(Field) }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

const type = async (value) => {
  const input = document.getElementById('name')
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}
const cross = () => document.body.querySelector('button[aria-label="Fermer"]')
const confirm = () => document.body.querySelector('[role="alertdialog"]')
const confirmButton = (label) => [...confirm().querySelectorAll('button')].find((b) => b.textContent.trim() === label)

describe('FormModal', () => {
  it('rien de saisi : la croix ferme tout de suite, sans confirmation', async () => {
    const w = await open()

    cross().click()
    await flushPromises()

    expect(w.emitted('close')).toHaveLength(1)
    expect(confirm()).toBeNull()
  })

  it('saisie modifiée : la croix demande d\'abord confirmation', async () => {
    const w = await open()
    await type('Loyer')

    cross().click()
    await flushPromises()

    expect(confirm().textContent).toContain('Abandonner la saisie ?')
    expect(w.emitted('close')).toBeUndefined()
  })

  it('« Continuer » garde la modale et la saisie', async () => {
    const w = await open()
    await type('Loyer')
    cross().click()
    await flushPromises()

    confirmButton('Continuer').click()
    await flushPromises()

    expect(confirm()).toBeNull()
    expect(document.getElementById('name').value).toBe('Loyer')
    expect(w.emitted('close')).toBeUndefined()
  })

  it('« Abandonner » ferme la modale', async () => {
    const w = await open()
    await type('Loyer')
    cross().click()
    await flushPromises()

    confirmButton('Abandonner').click()
    await flushPromises()

    expect(w.emitted('close')).toHaveLength(1)
  })

  it('Échap, fond : même comportement que la croix', async () => {
    const w = await open()
    await type('Loyer')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()

    expect(confirm()).not.toBeNull()
    expect(w.emitted('close')).toBeUndefined()
  })

  it('pendant la confirmation, Échap ne ferme pas la modale d\'un coup (il annule seulement la confirmation)', async () => {
    const w = await open()
    await type('Loyer')
    cross().click()
    await flushPromises()

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()

    expect(confirm()).toBeNull()
    expect(w.emitted('close')).toBeUndefined()
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
  })

  it('revenir à la valeur d\'origine annule l\'état « modifié »', async () => {
    const w = await open()
    await type('Loyer')
    await type('')

    cross().click()
    await flushPromises()

    expect(w.emitted('close')).toHaveLength(1)
  })
})
