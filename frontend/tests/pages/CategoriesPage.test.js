/**
 * Tests page — CategoriesPage (arbre, édition, réordonnancement, suppression)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import CategoriesPage from '@/pages/CategoriesPage.vue'
import { useToastStore } from '@/stores/toast.store.js'
import { mockApi, calls } from '../stores/_helpers.js'

const cat = (id, name, extra = {}) => ({
  id, name, color: '#4ade80', position: 0, parentId: null, transactionCount: 0, childrenCount: 0, ...extra,
})
const FOOD = cat('food', 'Alimentation', { position: 0, childrenCount: 1, transactionCount: 12 })
const RESTO = cat('resto', 'Restaurants', { parentId: 'food' })
const TRANSPORT = cat('transport', 'Transport', { position: 1 })

let wrapper
async function mountPage(items = [FOOD, TRANSPORT, RESTO], handler = () => ({ body: items })) {
  const fetchMock = mockApi((req) => (req.method === 'GET' ? { body: items } : handler(req)))
  wrapper = mount(CategoriesPage, { attachTo: document.body })
  await flushPromises()
  return fetchMock
}
const btn = (label) => wrapper.find(`button[aria-label="${label}"]`)
const dialog = () => document.body.querySelector('[role="alertdialog"]')
// La modale de saisie est téléportée dans <body>.
const modal = () => document.body.querySelector('[role="dialog"]')
const field = (selector) => new DOMWrapper(document.body.querySelector(selector))
const modalButton = (label) => [...modal().querySelectorAll('button')].find((b) => b.textContent.trim() === label)
const dialogButton = (label) => [...dialog().querySelectorAll('button')].find((b) => b.textContent.trim() === label)
const rows = () => wrapper.findAll('li.category')

beforeEach(() => vi.unstubAllGlobals())
afterEach(() => wrapper?.unmount())

describe('CategoriesPage — affichage', () => {
  it('range les sous-catégories sous leur parent, en retrait', async () => {
    await mountPage()

    expect(rows().map((r) => r.find('.category__name').text())).toEqual(['Alimentation', 'Restaurants', 'Transport'])
    expect(rows()[1].classes()).toContain('category--child')
    expect(rows()[0].classes()).not.toContain('category--child')
  })

  it('sans catégorie : message vide', async () => {
    await mountPage([])

    expect(wrapper.text()).toContain('Aucune catégorie pour l\'instant.')
  })

  it('au repos, aucun formulaire à l\'écran : seulement la liste', async () => {
    await mountPage()

    expect(modal()).toBeNull()
    expect(wrapper.find('form').exists()).toBe(false)
    expect(document.body.querySelector('#category-name')).toBeNull()
  })

  it('désactive « Monter » sur la première ligne et « Descendre » sur la dernière, par niveau', async () => {
    await mountPage()

    expect(btn('Monter Alimentation').attributes('disabled')).toBeDefined()
    expect(btn('Descendre Alimentation').attributes('disabled')).toBeUndefined()
    expect(btn('Descendre Transport').attributes('disabled')).toBeDefined()
    // Restaurants est seule dans son groupe
    expect(btn('Monter Restaurants').attributes('disabled')).toBeDefined()
    expect(btn('Descendre Restaurants').attributes('disabled')).toBeDefined()
  })
})

describe('CategoriesPage — création', () => {
  it('le bouton flottant ouvre la modale de création', async () => {
    await mountPage()

    await wrapper.find('button[aria-label="Ajouter une catégorie"]').trigger('click')

    expect(modal().textContent).toContain('Nouvelle catégorie')
    expect(field('#category-name').element.value).toBe('')
  })

  it('enregistrer ferme la modale et ajoute la catégorie', async () => {
    await mountPage([FOOD, TRANSPORT], () => ({ body: cat('new', 'Loisirs') }))

    await wrapper.find('button[aria-label="Ajouter une catégorie"]').trigger('click')
    await field('#category-name').setValue('Loisirs')
    await new DOMWrapper(modal().querySelector('form')).trigger('submit')
    await flushPromises()

    expect(modal()).toBeNull()
    expect(useToastStore().items[0].message).toBe('Catégorie ajoutée.')
  })
})

describe('CategoriesPage — édition', () => {
  it('« Modifier » ouvre la modale préremplie', async () => {
    await mountPage()

    await btn('Modifier Transport').trigger('click')

    expect(modal().textContent).toContain('Modifier la catégorie')
    expect(field('#category-name').element.value).toBe('Transport')
  })

  it('« Annuler » referme la modale', async () => {
    await mountPage()

    await btn('Modifier Transport').trigger('click')
    modalButton('Annuler').click()
    await flushPromises()

    expect(modal()).toBeNull()
  })

  it('Échap referme la modale quand rien n\'a été modifié', async () => {
    await mountPage()

    await btn('Modifier Transport').trigger('click')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()

    expect(modal()).toBeNull()
  })

  it('une saisie modifiée demande confirmation avant d\'être abandonnée', async () => {
    await mountPage()

    await btn('Modifier Transport').trigger('click')
    await field('#category-name').setValue('Autre nom')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()

    expect(dialog().textContent).toContain('Abandonner la saisie ?')
    expect(modal()).not.toBeNull()

    dialogButton('Abandonner').click()
    await flushPromises()
    expect(modal()).toBeNull()
  })
})

describe('CategoriesPage — réordonnancement', () => {
  it('descendre une catégorie persiste les deux positions échangées', async () => {
    const fetchMock = await mountPage([FOOD, TRANSPORT, RESTO], () => ({ body: {} }))

    await btn('Descendre Alimentation').trigger('click')
    await flushPromises()

    const puts = calls(fetchMock).filter((c) => c.method === 'PUT')
    expect(puts.map((p) => [p.path, p.body])).toEqual(
      expect.arrayContaining([
        ['/api/categories/transport', { position: 0 }],
        ['/api/categories/food', { position: 1 }],
      ]),
    )
  })

  it('affiche l\'erreur si l\'écriture échoue', async () => {
    await mountPage([FOOD, TRANSPORT, RESTO], () => ({ ok: false, status: 500, body: { error: 'Erreur serveur.' } }))

    await btn('Descendre Alimentation').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="alert"]').text()).toContain('Erreur serveur.')
  })
})

describe('CategoriesPage — suppression', () => {
  it('annonce les transactions et sous-catégories concernées', async () => {
    await mountPage()

    await btn('Supprimer Alimentation').trigger('click')

    const text = dialog().textContent.replace(/\s+/g, ' ')
    expect(text).toContain('Supprimer « Alimentation » ?')
    expect(text).toContain('12 transactions seront sans catégorie')
    expect(text).toContain('1 sous-catégorie deviendra une catégorie principale')
  })

  it('propose la recatégorisation (sans la catégorie supprimée) et l\'envoie', async () => {
    const fetchMock = await mountPage([FOOD, TRANSPORT, RESTO], () => ({ body: { deleted: true } }))

    await btn('Supprimer Alimentation').trigger('click')
    const select = dialog().querySelector('#reassign-to')
    const values = [...select.options].map((o) => o.value)
    expect(values).toContain('transport')
    expect(values).not.toContain('food')

    select.value = 'transport'
    select.dispatchEvent(new Event('change'))
    dialogButton('Supprimer').click()
    await flushPromises()

    const del = calls(fetchMock).find((c) => c.method === 'DELETE')
    expect(del).toMatchObject({ path: '/api/categories/food', body: { reassignTo: 'transport' } })
    expect(useToastStore().items[0].message).toBe('Catégorie supprimée.')
    expect(dialog()).toBeNull()
  })

  it('une catégorie sans transaction ne propose pas de recatégorisation', async () => {
    await mountPage()

    await btn('Supprimer Transport').trigger('click')

    expect(dialog().querySelector('#reassign-to')).toBeNull()
  })

  it('Annuler ne supprime rien', async () => {
    const fetchMock = await mountPage()

    await btn('Supprimer Transport').trigger('click')
    dialogButton('Annuler').click()
    await flushPromises()

    expect(dialog()).toBeNull()
    expect(calls(fetchMock).some((c) => c.method === 'DELETE')).toBe(false)
  })


})
