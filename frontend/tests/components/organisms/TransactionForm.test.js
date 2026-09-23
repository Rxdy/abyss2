/**
 * Tests composant — TransactionForm
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TransactionForm from '@/components/organisms/TransactionForm.vue'
import { useCategoriesStore } from '@/stores/categories.store.js'
import { useToastStore } from '@/stores/toast.store.js'
import { todayISO } from '@/utils/format.js'
import { mockApi, calls } from '../../stores/_helpers.js'

const TX = {
  id: 't1', title: 'Courses', amount: 4250, date: '2026-09-05', type: 'expense',
  note: 'chez Marc', recurringId: null, category: { id: 'food', name: 'Alimentation' },
}

beforeEach(() => {
  vi.unstubAllGlobals()
  const store = useCategoriesStore()
  store.items = [{ id: 'food', name: 'Alimentation', parentId: null }, { id: 'home', name: 'Logement', parentId: null }]
  store.loaded = true
})

const mountForm = (props = {}) => mount(TransactionForm, { props, attachTo: document.body })
const submit = async (w) => { await w.find('form').trigger('submit'); await flushPromises() }
const dialog = () => document.body.querySelector('[role="alertdialog"]')
const dialogButton = (label) => [...dialog().querySelectorAll('button')].find((b) => b.textContent.trim() === label)

describe('TransactionForm — création', () => {
  it('démarre vide : dépense, à la date du jour', () => {
    const w = mountForm()

    expect(w.find('#transaction-title').element.value).toBe('')
    expect(w.find('#transaction-date').element.value).toBe(todayISO())
    expect(w.text()).toContain('Ajouter')
    expect(w.text()).not.toContain('Supprimer')
    w.unmount()
  })

  it('signale libellé et montant manquants sans appeler l\'API', async () => {
    const fetchMock = mockApi(() => ({ body: {} }))
    const w = mountForm()

    await submit(w)

    expect(w.text()).toContain('Le libellé est requis.')
    expect(w.text()).toContain('Montant invalide')
    expect(fetchMock).not.toHaveBeenCalled()
    w.unmount()
  })

  it('crée la transaction (montant en centimes, note vide → null), notifie et prévient le parent', async () => {
    const fetchMock = mockApi(() => ({ body: { ...TX, id: 'new' } }))
    const w = mountForm()

    await w.find('#transaction-title').setValue('Café')
    await w.find('#transaction-amount').setValue('3,50')
    await submit(w)

    expect(calls(fetchMock)[0]).toMatchObject({
      method: 'POST', path: '/api/transactions',
      body: { title: 'Café', amount: 350, type: 'expense', categoryId: null, note: null },
    })
    expect(useToastStore().items[0].message).toBe('Transaction ajoutée.')
    expect(w.emitted('saved')).toHaveLength(1)
    w.unmount()
  })

  it('envoie la note saisie', async () => {
    const fetchMock = mockApi(() => ({ body: TX }))
    const w = mountForm()

    await w.find('#transaction-title').setValue('Café')
    await w.find('#transaction-amount').setValue('3,50')
    await w.find('#transaction-note').setValue('  avec Marc  ')
    await submit(w)

    expect(calls(fetchMock)[0].body.note).toBe('avec Marc')
    w.unmount()
  })

  it('affiche l\'erreur de l\'API sans prévenir le parent', async () => {
    mockApi(() => ({ ok: false, status: 400, body: { error: 'Catégorie introuvable.' } }))
    const w = mountForm()

    await w.find('#transaction-title').setValue('Café')
    await w.find('#transaction-amount').setValue('3,50')
    await submit(w)

    expect(w.find('[role="alert"]').text()).toContain('Catégorie introuvable.')
    expect(w.emitted('saved')).toBeUndefined()
    w.unmount()
  })

  it('« Annuler » prévient le parent', async () => {
    const w = mountForm()

    await w.findAll('button').find((b) => b.text() === 'Annuler').trigger('click')

    expect(w.emitted('cancel')).toHaveLength(1)
    w.unmount()
  })
})

describe('TransactionForm — modification', () => {
  it('préremplit tous les champs, note comprise', () => {
    const w = mountForm({ transaction: TX })

    expect(w.find('#transaction-title').element.value).toBe('Courses')
    expect(w.find('#transaction-amount').element.value).toBe('42,5')
    expect(w.find('#transaction-date').element.value).toBe('2026-09-05')
    expect(w.find('#transaction-category').element.value).toBe('food')
    expect(w.find('#transaction-note').element.value).toBe('chez Marc')
    expect(w.text()).toContain('Enregistrer')
    w.unmount()
  })

  it('envoie un PUT avec les valeurs modifiées', async () => {
    const fetchMock = mockApi(() => ({ body: { ...TX, title: 'Carrefour' } }))
    const w = mountForm({ transaction: TX })

    await w.find('#transaction-title').setValue('Carrefour')
    await submit(w)

    expect(calls(fetchMock)[0]).toMatchObject({ method: 'PUT', path: '/api/transactions/t1', body: { title: 'Carrefour', note: 'chez Marc' } })
    expect(useToastStore().items[0].message).toBe('Transaction modifiée.')
    w.unmount()
  })

  it('une transaction générée par une charge fixe le signale', () => {
    const w = mountForm({ transaction: { ...TX, recurringId: 'r1' } })

    expect(w.text()).toContain('Générée automatiquement par une charge fixe.')
    w.unmount()
  })
})

describe('TransactionForm — suppression', () => {
  it('demande confirmation avant de supprimer', async () => {
    const fetchMock = mockApi(() => ({ body: { deleted: true } }))
    const w = mountForm({ transaction: TX })

    await w.findAll('button').find((b) => b.text() === 'Supprimer').trigger('click')

    expect(dialog().textContent).toContain('Supprimer cette transaction ?')
    expect(dialog().textContent).toContain('Courses')
    expect(calls(fetchMock).some((c) => c.method === 'DELETE')).toBe(false)
    w.unmount()
  })

  it('supprime après confirmation, notifie et prévient le parent', async () => {
    const fetchMock = mockApi(() => ({ body: { deleted: true } }))
    const w = mountForm({ transaction: TX })

    await w.findAll('button').find((b) => b.text() === 'Supprimer').trigger('click')
    dialogButton('Supprimer').click()
    await flushPromises()

    expect(calls(fetchMock).find((c) => c.method === 'DELETE').path).toBe('/api/transactions/t1')
    expect(useToastStore().items[0].message).toBe('Transaction supprimée.')
    expect(w.emitted('deleted')).toEqual([['t1']])
    w.unmount()
  })

  it('Annuler ne supprime rien', async () => {
    const fetchMock = mockApi(() => ({ body: {} }))
    const w = mountForm({ transaction: TX })

    await w.findAll('button').find((b) => b.text() === 'Supprimer').trigger('click')
    dialogButton('Annuler').click()
    await flushPromises()

    expect(dialog()).toBeNull()
    expect(calls(fetchMock)).toHaveLength(0)
    w.unmount()
  })

  it('une erreur de suppression referme la confirmation et s\'affiche dans le formulaire', async () => {
    mockApi(() => ({ ok: false, status: 500, body: { error: 'Erreur serveur.' } }))
    const w = mountForm({ transaction: TX })

    await w.findAll('button').find((b) => b.text() === 'Supprimer').trigger('click')
    dialogButton('Supprimer').click()
    await flushPromises()

    expect(dialog()).toBeNull()
    expect(w.find('[role="alert"]').text()).toContain('Erreur serveur.')
    expect(w.emitted('deleted')).toBeUndefined()
    w.unmount()
  })
})
