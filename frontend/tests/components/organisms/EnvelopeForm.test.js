/**
 * Tests composant — EnvelopeForm
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import EnvelopeForm from '@/components/organisms/EnvelopeForm.vue'
import { useCategoriesStore } from '@/stores/categories.store.js'
import { useToastStore } from '@/stores/toast.store.js'
import { mockApi, calls } from '../../stores/_helpers.js'

const FOOD = { id: 'food', name: 'Alimentation' }
const FUN  = { id: 'fun', name: 'Loisirs' }

beforeEach(() => {
  vi.unstubAllGlobals()
  const store = useCategoriesStore()
  store.items = [FOOD, FUN]
  store.loaded = true
})

const mountForm = (props = {}) => mount(EnvelopeForm, { props })
const submit = async (w) => { await w.find('form').trigger('submit'); await flushPromises() }
const chip = (w, text) => w.findAll('button').find((b) => b.text() === text)

describe('EnvelopeForm — création', () => {
  it('démarre vide, aucune catégorie sélectionnée', () => {
    const w = mountForm()

    expect(w.find('#envelope-name').element.value).toBe('')
    expect(w.find('#envelope-budget').element.value).toBe('')
    expect(chip(w, 'Alimentation').attributes('aria-pressed')).toBe('false')
  })

  it('refuse un nom vide sans appeler l\'API', async () => {
    const fetchMock = mockApi(() => ({ body: {} }))
    const w = mountForm()

    await w.find('#envelope-budget').setValue('400')
    await submit(w)

    expect(w.find('[role="alert"]').text()).toContain('Le nom est requis.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuse un montant vide ou invalide sans appeler l\'API', async () => {
    const fetchMock = mockApi(() => ({ body: {} }))
    const w = mountForm()

    await w.find('#envelope-name').setValue('Vie quotidienne')
    await submit(w)

    expect(w.text()).toContain('Le montant est requis.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('crée l\'enveloppe avec les catégories cochées, notifie et prévient le parent', async () => {
    const fetchMock = mockApi(() => ({ body: { id: 'new', name: 'Vie quotidienne', budget: 40000, categoryIds: ['food'] } }))
    const w = mountForm()

    await w.find('#envelope-name').setValue('Vie quotidienne')
    await w.find('#envelope-budget').setValue('400')
    await chip(w, 'Alimentation').trigger('click')
    await submit(w)

    expect(calls(fetchMock)[0]).toMatchObject({
      method: 'POST', path: '/api/envelopes',
      body: { name: 'Vie quotidienne', budget: 40000, categoryIds: ['food'] },
    })
    expect(useToastStore().items.map((t) => t.message)).toEqual(['Enveloppe ajoutée.'])
    expect(w.emitted('saved')).toHaveLength(1)
  })

  it('une catégorie recochée est retirée de la sélection', async () => {
    const fetchMock = mockApi(() => ({ body: { id: 'new' } }))
    const w = mountForm()

    await w.find('#envelope-name').setValue('Vie quotidienne')
    await w.find('#envelope-budget').setValue('400')
    await chip(w, 'Alimentation').trigger('click')
    await chip(w, 'Alimentation').trigger('click')
    await submit(w)

    expect(calls(fetchMock)[0].body.categoryIds).toEqual([])
  })

  it('affiche l\'erreur de l\'API et ne prévient pas le parent', async () => {
    mockApi(() => ({ ok: false, status: 400, body: { error: 'Montant invalide.' } }))
    const w = mountForm()

    await w.find('#envelope-name').setValue('Vie quotidienne')
    await w.find('#envelope-budget').setValue('400')
    await submit(w)

    expect(w.find('[role="alert"]').text()).toContain('Montant invalide.')
    expect(w.emitted('saved')).toBeUndefined()
  })

  it('« Annuler » prévient le parent sans appeler l\'API', async () => {
    const fetchMock = mockApi(() => ({ body: {} }))
    const w = mountForm()

    await w.findAll('button').find((b) => b.text() === 'Annuler').trigger('click')

    expect(w.emitted('cancel')).toHaveLength(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('EnvelopeForm — modification', () => {
  const ENVELOPE = { id: 'e1', name: 'Vie quotidienne', budget: 40000, categoryIds: ['food'] }

  it('préremplit nom, budget et catégories cochées', () => {
    const w = mountForm({ envelope: ENVELOPE })

    expect(w.find('#envelope-name').element.value).toBe('Vie quotidienne')
    expect(w.find('#envelope-budget').element.value).toBe('400')
    expect(chip(w, 'Alimentation').attributes('aria-pressed')).toBe('true')
    expect(chip(w, 'Loisirs').attributes('aria-pressed')).toBe('false')
  })

  it('envoie un PUT avec les nouvelles valeurs', async () => {
    const fetchMock = mockApi(() => ({ body: { ...ENVELOPE, name: 'Quotidien' } }))
    const w = mountForm({ envelope: ENVELOPE })

    await w.find('#envelope-name').setValue('Quotidien')
    await submit(w)

    expect(calls(fetchMock)[0]).toMatchObject({ method: 'PUT', path: '/api/envelopes/e1' })
    expect(calls(fetchMock)[0].body.name).toBe('Quotidien')
    expect(useToastStore().items[0].message).toBe('Enveloppe modifiée.')
  })

  it('ajouter une catégorie l\'inclut avec celles déjà cochées', async () => {
    const fetchMock = mockApi(() => ({ body: ENVELOPE }))
    const w = mountForm({ envelope: ENVELOPE })

    await chip(w, 'Loisirs').trigger('click')
    await submit(w)

    expect(calls(fetchMock)[0].body.categoryIds.sort()).toEqual(['food', 'fun'])
  })
})
