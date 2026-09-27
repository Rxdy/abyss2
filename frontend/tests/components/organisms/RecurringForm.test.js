/**
 * Tests composant — RecurringForm
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import RecurringForm from '@/components/organisms/RecurringForm.vue'
import { useCategoriesStore } from '@/stores/categories.store.js'
import { useToastStore } from '@/stores/toast.store.js'
import { todayISO } from '@/utils/format.js'
import { mockApi, calls } from '../../stores/_helpers.js'

const ITEM = {
  id: 'r1', title: 'Loyer', amount: 72050, type: 'expense', dayOfMonth: 5,
  startDate: '2026-01-05', endDate: '2027-01-05', category: { id: 'home', name: 'Logement' },
}

beforeEach(() => {
  vi.unstubAllGlobals()
  const store = useCategoriesStore()
  store.items = [{ id: 'home', name: 'Logement', parentId: null }]
  store.loaded = true
})

const mountForm = (props = {}) => mount(RecurringForm, { props })
const submit = async (w) => { await w.find('form').trigger('submit'); await flushPromises() }

async function fillValid(w) {
  await w.find('#recurring-title').setValue('Netflix')
  await w.find('#recurring-amount').setValue('13,99')
}

describe('RecurringForm — validation', () => {
  it('démarre vide : dépense, le 1er du mois, à partir d\'aujourd\'hui', () => {
    const w = mountForm()

    expect(w.find('#recurring-title').element.value).toBe('')
    expect(w.find('#recurring-day').element.value).toBe('1')
    expect(w.find('#recurring-start').element.value).toBe(todayISO())
    expect(w.find('#recurring-end').element.value).toBe('')
  })

  it('signale libellé, montant et jour invalides sans appeler l\'API', async () => {
    const fetchMock = mockApi(() => ({ body: {} }))
    const w = mountForm()

    await w.find('#recurring-day').setValue('32')
    await submit(w)

    expect(w.text()).toContain('Le libellé est requis.')
    expect(w.text()).toContain('Montant invalide')
    expect(w.text()).toContain('Jour du mois entre 1 et 31.')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('RecurringForm — création', () => {
  it('envoie montant en centimes et catégorie, notifie et prévient le parent', async () => {
    const fetchMock = mockApi(() => ({ body: { ...ITEM, id: 'new' } }))
    const w = mountForm()

    await fillValid(w)
    await w.find('#recurring-day').setValue('12')
    await w.find('#recurring-category').setValue('home')
    await submit(w)

    expect(calls(fetchMock)[0]).toMatchObject({
      method: 'POST', path: '/api/recurring',
      body: { title: 'Netflix', amount: 1399, type: 'expense', dayOfMonth: 12, categoryId: 'home', endDate: null },
    })
    expect(useToastStore().items[0].message).toBe('Charge fixe ajoutée.')
    expect(w.emitted('saved')).toHaveLength(1)
  })

  it('permet de choisir un revenu', async () => {
    const fetchMock = mockApi(() => ({ body: ITEM }))
    const w = mountForm()

    await w.findAll('button').find((b) => b.text().includes('Revenu')).trigger('click')
    await fillValid(w)
    await submit(w)

    expect(calls(fetchMock)[0].body.type).toBe('income')
  })

  it('affiche l\'erreur de l\'API et ne prévient pas le parent', async () => {
    mockApi(() => ({ ok: false, status: 400, body: { error: 'Catégorie introuvable.' } }))
    const w = mountForm()

    await fillValid(w)
    await submit(w)

    expect(w.find('[role="alert"]').text()).toContain('Catégorie introuvable.')
    expect(w.emitted('saved')).toBeUndefined()
  })
})

describe('RecurringForm — création : annulation', () => {
  it('« Annuler » est toujours proposé (la modale n\'a pas de mode « lecture »)', async () => {
    const w = mountForm()

    await w.findAll('button').find((b) => b.text() === 'Annuler').trigger('click')

    expect(w.emitted('cancel')).toHaveLength(1)
  })
})

describe('RecurringForm — modification', () => {
  it('préremplit tous les champs (montant en euros avec virgule)', () => {
    const w = mountForm({ item: ITEM })

    expect(w.find('#recurring-title').element.value).toBe('Loyer')
    expect(w.find('#recurring-amount').element.value).toBe('720,5')
    expect(w.find('#recurring-day').element.value).toBe('5')
    expect(w.find('#recurring-category').element.value).toBe('home')
    expect(w.find('#recurring-start').element.value).toBe('2026-01-05')
    expect(w.find('#recurring-end').element.value).toBe('2027-01-05')
  })

  it('envoie un PUT et notifie « modifiée »', async () => {
    const fetchMock = mockApi(() => ({ body: ITEM }))
    const w = mountForm({ item: ITEM })

    await w.find('#recurring-amount').setValue('730')
    await submit(w)

    expect(calls(fetchMock)[0]).toMatchObject({ method: 'PUT', path: '/api/recurring/r1', body: { amount: 73000 } })
    expect(useToastStore().items[0].message).toBe('Charge fixe modifiée.')
  })

  it('Annuler prévient le parent', async () => {
    const w = mountForm({ item: ITEM })

    await w.findAll('button').find((b) => b.text() === 'Annuler').trigger('click')

    expect(w.emitted('cancel')).toHaveLength(1)
  })
})
