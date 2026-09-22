/**
 * Tests composant — BaseModal
 */

import { describe, it, expect, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, nextTick } from 'vue'
import BaseModal from '@/components/molecules/BaseModal.vue'

let wrapper
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.style.overflow = ''
  document.body.innerHTML = ''
})

const FORM = () => h('div', [
  h('input', { id: 'first', type: 'text' }),
  h('input', { id: 'second', type: 'text' }),
  h('button', { id: 'submit', type: 'button' }, 'Valider'),
])

async function open(props = {}, slot = FORM) {
  wrapper = mount(BaseModal, { props: { title: 'Nouvelle transaction', ...props }, slots: { default: slot }, attachTo: document.body })
  await nextTick()
  await nextTick()
  return wrapper
}

const dialog = () => document.body.querySelector('[role="dialog"]')
const key = (k, opts = {}) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, ...opts }))

describe('BaseModal — accessibilité', () => {
  it('est un dialogue modal nommé par son titre', async () => {
    await open()

    expect(dialog().getAttribute('aria-modal')).toBe('true')
    const title = document.getElementById(dialog().getAttribute('aria-labelledby'))
    expect(title.textContent).toBe('Nouvelle transaction')
  })

  it('est téléportée dans <body> (pas dans le composant parent)', async () => {
    const w = await open()

    expect(w.find('[role="dialog"]').exists()).toBe(false)
    expect(dialog()).not.toBeNull()
  })

  it('affiche son contenu', async () => {
    await open()

    expect(dialog().querySelector('#first')).not.toBeNull()
  })
})

describe('BaseModal — fermeture', () => {
  it('la croix émet close', async () => {
    const w = await open()

    document.body.querySelector('button[aria-label="Fermer"]').click()

    expect(w.emitted('close')).toHaveLength(1)
  })

  it('Échap émet close', async () => {
    const w = await open()

    key('Escape')

    expect(w.emitted('close')).toHaveLength(1)
  })

  it('un clic sur le fond émet close, pas un clic dans la fenêtre', async () => {
    const w = await open()

    dialog().dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(w.emitted('close')).toBeUndefined()

    document.body.querySelector('.modal-overlay').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('closable=false suspend croix, fond et Échap', async () => {
    const w = await open({ closable: false })

    document.body.querySelector('button[aria-label="Fermer"]').click()
    document.body.querySelector('.modal-overlay').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    key('Escape')

    expect(w.emitted('close')).toBeUndefined()
  })

  it('ne réagit plus à Échap une fois démontée', async () => {
    const w = await open()
    w.unmount()
    wrapper = null

    key('Escape')

    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
  })
})

describe('BaseModal — focus', () => {
  it('place le focus sur le premier champ', async () => {
    await open()

    expect(document.activeElement.id).toBe('first')
  })

  it('même précédé de boutons, c\'est le premier champ qui reçoit le focus', async () => {
    await open({}, () => h('div', [
      h('button', { id: 'toggle', type: 'button' }, 'Dépense'),
      h('input', { id: 'title', type: 'text' }),
    ]))

    expect(document.activeElement.id).toBe('title')
  })

  it('sans champ, le focus va au premier élément actif', async () => {
    await open({}, () => h('p', 'Rien à saisir'))

    expect(document.activeElement.getAttribute('aria-label')).toBe('Fermer')
  })

  it('Tab boucle du dernier élément au premier, Maj+Tab dans l\'autre sens', async () => {
    await open()
    const close = document.body.querySelector('button[aria-label="Fermer"]')

    document.getElementById('submit').focus()
    dialog().dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(close)

    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
    dialog().dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement.id).toBe('submit')
  })

  it('rend le focus au bouton d\'origine à la fermeture', async () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()

    const w = await open()
    expect(document.activeElement).not.toBe(opener)

    w.unmount()
    wrapper = null

    expect(document.activeElement).toBe(opener)
  })
})

describe('BaseModal — défilement de la page', () => {
  it('est bloqué à l\'ouverture et rétabli à la fermeture', async () => {
    document.body.style.overflow = 'auto'
    const w = await open()
    expect(document.body.style.overflow).toBe('hidden')

    w.unmount()
    wrapper = null
    expect(document.body.style.overflow).toBe('auto')
  })

  it('reste bloqué tant qu\'une autre modale est ouverte', async () => {
    const first = await open()
    const second = mount(BaseModal, { props: { title: 'Autre' }, attachTo: document.body })
    await nextTick()

    second.unmount()
    expect(document.body.style.overflow).toBe('hidden')

    first.unmount()
    wrapper = null
    expect(document.body.style.overflow).toBe('')
  })
})
