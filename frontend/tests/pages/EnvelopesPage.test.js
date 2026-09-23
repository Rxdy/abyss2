/**
 * Tests page — EnvelopesPage (liste, édition, suppression)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import EnvelopesPage from '@/pages/EnvelopesPage.vue'
import { useToastStore } from '@/stores/toast.store.js'
import { mockApi, calls } from '../stores/_helpers.js'

const cat = (id, name) => ({ id, name, color: '#4ade80', position: 0, parentId: null, envelopeId: null })
const env = (id, name, extra = {}) => ({ id, name, budget: 40000, categoryIds: [], ...extra })

const FOOD = cat('food', 'Alimentation')
const FUN  = cat('fun', 'Loisirs')
const QUOTIDIEN = env('e1', 'Vie quotidienne', { categoryIds: ['food'] })

let wrapper
async function mountPage(envelopes = [QUOTIDIEN], categories = [FOOD, FUN], handler = () => ({ body: {} })) {
  const fetchMock = mockApi((req) => {
    if (req.method === 'GET' && req.url.pathname === '/api/envelopes')  return { body: envelopes }
    if (req.method === 'GET' && req.url.pathname === '/api/categories') return { body: categories }
    return handler(req)
  })
  wrapper = mount(EnvelopesPage, { attachTo: document.body })
  await flushPromises()
  return fetchMock
}

const btn = (label) => wrapper.find(`button[aria-label="${label}"]`)
const dialog = () => document.body.querySelector('[role="alertdialog"]')
const modal  = () => document.body.querySelector('[role="dialog"]')
const field  = (selector) => new DOMWrapper(document.body.querySelector(selector))
const dialogButton = (label) => [...dialog().querySelectorAll('button')].find((b) => b.textContent.trim() === label)
const rows = () => wrapper.findAll('li.envelope')

beforeEach(() => vi.unstubAllGlobals())
afterEach(() => wrapper?.unmount())

describe('EnvelopesPage — affichage', () => {
  it('liste les enveloppes avec leurs catégories liées', async () => {
    await mountPage()

    expect(rows()).toHaveLength(1)
    expect(wrapper.text()).toContain('Vie quotidienne')
    expect(wrapper.text()).toContain('Alimentation')
  })

  it('sans enveloppe : message vide', async () => {
    await mountPage([])

    expect(wrapper.text()).toContain('Aucune enveloppe pour l\'instant.')
  })
})

describe('EnvelopesPage — création', () => {
  it('le bouton flottant ouvre la modale de création', async () => {
    await mountPage()

    await wrapper.find('button[aria-label="Ajouter une enveloppe"]').trigger('click')

    expect(modal().textContent).toContain('Nouvelle enveloppe')
    expect(field('#envelope-name').element.value).toBe('')
  })

  it('enregistrer ferme la modale et notifie', async () => {
    const fetchMock = await mountPage([], [FOOD, FUN], (req) => {
      if (req.method === 'POST') return { body: env('new', 'Loisirs') }
      return { body: [] }
    })

    await wrapper.find('button[aria-label="Ajouter une enveloppe"]').trigger('click')
    await field('#envelope-name').setValue('Loisirs')
    await field('#envelope-budget').setValue('400')
    await new DOMWrapper(modal().querySelector('form')).trigger('submit')
    await flushPromises()

    expect(modal()).toBeNull()
    expect(useToastStore().items[0].message).toBe('Enveloppe ajoutée.')
    expect(calls(fetchMock).some((c) => c.method === 'POST' && c.path === '/api/envelopes')).toBe(true)
  })
})

describe('EnvelopesPage — édition', () => {
  it('« Modifier » ouvre la modale préremplie', async () => {
    await mountPage()

    await btn('Modifier Vie quotidienne').trigger('click')

    expect(modal().textContent).toContain('Modifier l\'enveloppe')
    expect(field('#envelope-name').element.value).toBe('Vie quotidienne')
  })

  it('« Annuler » referme la modale', async () => {
    await mountPage()

    await btn('Modifier Vie quotidienne').trigger('click')
    ;[...modal().querySelectorAll('button')].find((b) => b.textContent.trim() === 'Annuler').click()
    await flushPromises()

    expect(modal()).toBeNull()
  })
})

describe('EnvelopesPage — suppression', () => {
  it('confirme, puis supprime et notifie', async () => {
    const fetchMock = await mountPage([QUOTIDIEN], [FOOD, FUN], (req) => {
      if (req.method === 'DELETE') return { body: { deleted: true } }
      return { body: [] }
    })

    await btn('Supprimer Vie quotidienne').trigger('click')
    expect(dialog().textContent).toContain('Supprimer « Vie quotidienne » ?')

    dialogButton('Supprimer').click()
    await flushPromises()

    const del = calls(fetchMock).find((c) => c.method === 'DELETE')
    expect(del).toMatchObject({ path: '/api/envelopes/e1' })
    expect(useToastStore().items[0].message).toBe('Enveloppe supprimée.')
    expect(dialog()).toBeNull()
    expect(rows()).toHaveLength(0)
  })

  it('Annuler ne supprime rien', async () => {
    const fetchMock = await mountPage()

    await btn('Supprimer Vie quotidienne').trigger('click')
    dialogButton('Annuler').click()
    await flushPromises()

    expect(dialog()).toBeNull()
    expect(calls(fetchMock).some((c) => c.method === 'DELETE')).toBe(false)
  })
})
