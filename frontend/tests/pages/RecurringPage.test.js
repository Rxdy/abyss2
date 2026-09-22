/**
 * Tests page — RecurringPage (liste, édition, pause, suppression)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import RecurringPage from '@/pages/RecurringPage.vue'
import { useToastStore } from '@/stores/toast.store.js'
import { mockApi, calls } from '../stores/_helpers.js'

const rec = (id, over = {}) => ({
  id, title: `Charge ${id}`, amount: 10000, type: 'expense', dayOfMonth: 5, active: true,
  startDate: '2026-01-05', endDate: null, nextDate: '2026-10-05', category: null, ...over,
})
const RENT = rec('rent', { title: 'Loyer', amount: 72000 })
const SALARY = rec('salary', { title: 'Salaire', amount: 235000, type: 'income' })

let wrapper
const mountPage = async (items = [RENT, SALARY], handler = () => ({ body: {} })) => {
  const fetchMock = mockApi((req) => {
    if (req.url.pathname === '/api/recurring' && req.method === 'GET') return { body: items }
    if (req.url.pathname === '/api/categories') return { body: [] }
    return handler(req)
  })
  wrapper = mount(RecurringPage, { attachTo: document.body })
  await flushPromises()
  return fetchMock
}
const btn = (label) => wrapper.find(`button[aria-label="${label}"]`)
const dialog = () => document.body.querySelector('[role="alertdialog"]')
// La modale de saisie est téléportée dans <body>.
const modal = () => document.body.querySelector('[role="dialog"]')
const field = (selector) => new DOMWrapper(document.body.querySelector(selector))
const modalButton = (label) => [...modal().querySelectorAll('button')].find((b) => b.textContent.trim() === label)

beforeEach(() => vi.unstubAllGlobals())
afterEach(() => wrapper?.unmount())

describe('RecurringPage — affichage', () => {
  it('liste les charges fixes et l\'impact mensuel net', async () => {
    await mountPage()

    expect(wrapper.findAll('li.item')).toHaveLength(2)
    expect(wrapper.text()).toContain('Impact mensuel net')
    expect(wrapper.text()).toMatch(/1\s630,00/) // 2350 − 720 (espace insécable fine entre milliers)
  })

  it('sans charge : message vide et pas de récapitulatif', async () => {
    await mountPage([])

    expect(wrapper.text()).toContain('Aucune dépense ou revenu fixe pour l\'instant.')
    expect(wrapper.text()).not.toContain('Impact mensuel net')
  })

  it('au repos, aucun formulaire à l\'écran : seulement la liste', async () => {
    await mountPage()

    expect(modal()).toBeNull()
    expect(wrapper.find('form').exists()).toBe(false)
    expect(document.body.querySelector('#recurring-title')).toBeNull()
  })
})

describe('RecurringPage — création', () => {
  it('« Ajouter » ouvre la modale de création', async () => {
    await mountPage()

    await wrapper.findAll('button').find((b) => b.text().includes('Ajouter') && !b.attributes('aria-label')).trigger('click')

    expect(modal().getAttribute('aria-label') ?? modal().textContent).toContain('Nouvelle charge fixe')
    expect(field('#recurring-title').element.value).toBe('')
  })

  it('le bouton flottant ouvre aussi la modale de création', async () => {
    await mountPage()

    await wrapper.find('button[aria-label="Ajouter une charge fixe"]').trigger('click')

    expect(modal()).not.toBeNull()
  })

  it('enregistrer ferme la modale et ajoute la ligne', async () => {
    const created = rec('new', { title: 'Netflix', amount: 1399 })
    await mountPage([RENT], () => ({ body: created }))

    await wrapper.find('button[aria-label="Ajouter une charge fixe"]').trigger('click')
    await field('#recurring-title').setValue('Netflix')
    await field('#recurring-amount').setValue('13,99')
    await new DOMWrapper(modal().querySelector('form')).trigger('submit')
    await flushPromises()

    expect(modal()).toBeNull()
    expect(wrapper.findAll('li.item')).toHaveLength(2)
    expect(useToastStore().items[0].message).toBe('Charge fixe ajoutée.')
  })
})

describe('RecurringPage — édition', () => {
  it('« Modifier » ouvre la modale préremplie', async () => {
    await mountPage()

    await btn('Modifier Loyer').trigger('click')

    expect(modal().textContent).toContain('Modifier la charge fixe')
    expect(field('#recurring-title').element.value).toBe('Loyer')
  })

  it('« Annuler » referme la modale sans rien enregistrer', async () => {
    const fetchMock = await mountPage()

    await btn('Modifier Loyer').trigger('click')
    modalButton('Annuler').click()
    await flushPromises()

    expect(modal()).toBeNull()
    expect(calls(fetchMock).some((c) => c.method === 'PUT')).toBe(false)
  })

  it('enregistrer une modification ferme la modale et met la ligne à jour', async () => {
    await mountPage([RENT], () => ({ body: { ...RENT, amount: 73000 } }))

    await btn('Modifier Loyer').trigger('click')
    await field('#recurring-amount').setValue('730')
    await new DOMWrapper(modal().querySelector('form')).trigger('submit')
    await flushPromises()

    expect(modal()).toBeNull()
    expect(wrapper.text()).toContain('730,00')
  })

  it('rouvrir sur une autre charge préremplit avec celle-ci', async () => {
    await mountPage()

    await btn('Modifier Loyer').trigger('click')
    modalButton('Annuler').click()
    await flushPromises()
    await btn('Modifier Salaire').trigger('click')

    expect(field('#recurring-title').element.value).toBe('Salaire')
  })

  it('fermer par la croix sans rien changer ne demande pas de confirmation', async () => {
    await mountPage()

    await btn('Modifier Loyer').trigger('click')
    document.body.querySelector('button[aria-label="Fermer"]').click()
    await flushPromises()

    expect(modal()).toBeNull()
    expect(dialog()).toBeNull()
  })

  it('fermer après avoir modifié un champ demande confirmation', async () => {
    await mountPage()

    await btn('Modifier Loyer').trigger('click')
    await field('#recurring-title').setValue('Loyer modifié')
    document.body.querySelector('button[aria-label="Fermer"]').click()
    await flushPromises()

    expect(dialog().textContent).toContain('Abandonner la saisie ?')
    expect(modal()).not.toBeNull()
  })
})

describe('RecurringPage — pause', () => {
  it('met en pause et annonce le résultat', async () => {
    const fetchMock = await mountPage([RENT], () => ({ body: { ...RENT, active: false } }))

    await btn('Mettre en pause Loyer').trigger('click')
    await flushPromises()

    expect(calls(fetchMock).at(-1)).toMatchObject({ method: 'PUT', path: '/api/recurring/rent', body: { active: false } })
    expect(useToastStore().items.map((t) => t.message)).toEqual(['Charge fixe mise en pause.'])
    expect(wrapper.text()).toContain('en pause')
  })

  it('réactive une charge en pause', async () => {
    const paused = { ...RENT, active: false }
    await mountPage([paused], () => ({ body: RENT }))

    await btn('Reprendre Loyer').trigger('click')
    await flushPromises()

    expect(useToastStore().items[0].message).toBe('Charge fixe réactivée.')
  })

  it('affiche l\'erreur si la bascule échoue', async () => {
    await mountPage([RENT], () => ({ ok: false, status: 500, body: { error: 'Erreur serveur.' } }))

    await btn('Mettre en pause Loyer').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('Erreur serveur.')
    expect(useToastStore().items).toHaveLength(0)
  })
})

describe('RecurringPage — suppression', () => {
  it('demande confirmation avant de supprimer', async () => {
    const fetchMock = await mountPage()

    await btn('Supprimer Loyer').trigger('click')

    expect(dialog().textContent).toContain('Supprimer « Loyer » ?')
    expect(calls(fetchMock).some((c) => c.method === 'DELETE')).toBe(false)
  })

  it('supprime après confirmation, retire la ligne et notifie', async () => {
    const fetchMock = await mountPage([RENT, SALARY], () => ({ body: { deleted: true } }))

    await btn('Supprimer Loyer').trigger('click')
    ;[...dialog().querySelectorAll('button')].find((b) => b.textContent.trim() === 'Supprimer').click()
    await flushPromises()

    expect(calls(fetchMock).find((c) => c.method === 'DELETE').path).toBe('/api/recurring/rent')
    expect(wrapper.findAll('li.item')).toHaveLength(1)
    expect(useToastStore().items[0].message).toBe('Charge fixe supprimée.')
    expect(dialog()).toBeNull()
  })

  it('Annuler garde la charge', async () => {
    await mountPage()

    await btn('Supprimer Loyer').trigger('click')
    ;[...dialog().querySelectorAll('button')].find((b) => b.textContent.trim() === 'Annuler').click()
    await flushPromises()

    expect(dialog()).toBeNull()
    expect(wrapper.findAll('li.item')).toHaveLength(2)
  })
})
