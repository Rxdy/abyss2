/**
 * Tests composant — CategoryForm
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CategoryForm from '@/components/organisms/CategoryForm.vue'
import { useCategoriesStore } from '@/stores/categories.store.js'
import { useToastStore } from '@/stores/toast.store.js'
import { CATEGORY_COLORS } from '@/utils/palette.js'
import { mockApi, calls } from '../../stores/_helpers.js'

const FOOD = { id: 'food', name: 'Alimentation', color: '#4ade80', parentId: null, childrenCount: 2 }
const TRANSPORT = { id: 'transport', name: 'Transport', color: '#38bdf8', parentId: null, childrenCount: 0 }

beforeEach(() => {
  vi.unstubAllGlobals()
  const store = useCategoriesStore()
  store.items = [FOOD, TRANSPORT]
  store.loaded = true
})

const mountForm = (props = {}) => mount(CategoryForm, { props })
const submit = async (w) => { await w.find('form').trigger('submit'); await flushPromises() }

describe('CategoryForm — création', () => {
  it('démarre vide, avec la première couleur de la palette', () => {
    const w = mountForm()

    expect(w.find('#category-name').element.value).toBe('')
    expect(w.find('button[aria-pressed="true"]').attributes('aria-label')).toBe(`Couleur ${CATEGORY_COLORS[0]}`)
  })

  it('« Annuler » est toujours proposé et prévient le parent', async () => {
    const w = mountForm()

    await w.findAll('button').find((b) => b.text() === 'Annuler').trigger('click')

    expect(w.emitted('cancel')).toHaveLength(1)
  })

  it('refuse un nom vide sans appeler l\'API', async () => {
    const fetchMock = mockApi(() => ({ body: {} }))
    const w = mountForm()

    await submit(w)

    expect(w.find('[role="alert"]').text()).toContain('Le nom est requis.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('crée la catégorie, notifie et prévient le parent', async () => {
    const fetchMock = mockApi(() => ({ body: { id: 'new', name: 'Loisirs', color: CATEGORY_COLORS[0], parentId: null } }))
    const w = mountForm()

    await w.find('#category-name').setValue('  Loisirs  ')
    await submit(w)

    expect(calls(fetchMock)[0]).toMatchObject({
      method: 'POST', path: '/api/categories',
      body: { name: 'Loisirs', color: CATEGORY_COLORS[0], parentId: null },
    })
    expect(useToastStore().items.map((t) => t.message)).toEqual(['Catégorie ajoutée.'])
    expect(w.emitted('saved')).toHaveLength(1)
  })

  it('peut rattacher la catégorie à un parent', async () => {
    const fetchMock = mockApi(() => ({ body: { id: 'new' } }))
    const w = mountForm()

    await w.find('#category-name').setValue('Restaurants')
    await w.find('#category-parent').setValue('food')
    await submit(w)

    expect(calls(fetchMock)[0].body.parentId).toBe('food')
  })

  it('affiche l\'erreur de l\'API et ne prévient pas le parent', async () => {
    mockApi(() => ({ ok: false, status: 409, body: { error: 'Nom déjà utilisé.' } }))
    const w = mountForm()

    await w.find('#category-name').setValue('Alimentation')
    await submit(w)

    expect(w.find('[role="alert"]').text()).toContain('Nom déjà utilisé.')
    expect(w.emitted('saved')).toBeUndefined()
  })
})

describe('CategoryForm — modification', () => {
  it('préremplit nom, couleur et parent, et propose Annuler', () => {
    const w = mountForm({ category: { id: 'resto', name: 'Restaurants', color: '#f87171', parentId: 'food' } })

    expect(w.find('#category-name').element.value).toBe('Restaurants')
    expect(w.find('#category-parent').element.value).toBe('food')
    expect(w.find('button[aria-pressed="true"]').attributes('aria-label')).toBe('Couleur #f87171')
    expect(w.text()).toContain('Annuler')
  })

  it('envoie un PUT avec les nouvelles valeurs', async () => {
    const fetchMock = mockApi(() => ({ body: { ...TRANSPORT, name: 'Déplacements' } }))
    const w = mountForm({ category: TRANSPORT })

    await w.find('#category-name').setValue('Déplacements')
    await submit(w)

    expect(calls(fetchMock)[0]).toMatchObject({ method: 'PUT', path: '/api/categories/transport' })
    expect(calls(fetchMock)[0].body.name).toBe('Déplacements')
    expect(useToastStore().items[0].message).toBe('Catégorie modifiée.')
  })

  it('ne propose pas la catégorie elle-même comme parente', () => {
    const w = mountForm({ category: TRANSPORT })

    const values = w.findAll('#category-parent option').map((o) => o.element.value)
    expect(values).toContain('food')
    expect(values).not.toContain('transport')
  })

  it('prévient qu\'une catégorie qui a des sous-catégories ne peut pas devenir enfant', () => {
    expect(mountForm({ category: FOOD }).text()).toContain('elle ne peut pas devenir elle-même une sous-catégorie')
    expect(mountForm({ category: TRANSPORT }).text()).not.toContain('elle ne peut pas devenir')
  })

  it('Annuler prévient le parent', async () => {
    const w = mountForm({ category: TRANSPORT })

    await w.findAll('button').find((b) => b.text() === 'Annuler').trigger('click')

    expect(w.emitted('cancel')).toHaveLength(1)
  })
})

describe('CategoryForm — budget mensuel', () => {
  const fill = async (w, budget) => {
    await w.find('#category-name').setValue('Loisirs')
    await w.find('#category-budget').setValue(budget)
    await submit(w)
  }

  it('champ facultatif, vide au départ', () => {
    const w = mountForm()

    expect(w.find('#category-budget').element.value).toBe('')
    expect(w.text()).toContain('optionnel')
  })

  it('envoie le budget en centimes à la création', async () => {
    const fetchMock = mockApi(() => ({ body: { id: 'new' } }))
    const w = mountForm()

    await fill(w, '400')

    expect(calls(fetchMock)[0].body).toMatchObject({ name: 'Loisirs', budget: 40000 })
  })

  it('accepte la virgule et les centimes', async () => {
    const fetchMock = mockApi(() => ({ body: { id: 'new' } }))
    const w = mountForm()

    await fill(w, '99,5')

    expect(calls(fetchMock)[0].body.budget).toBe(9950)
  })

  it('sans budget : rien n\'est envoyé à la création', async () => {
    const fetchMock = mockApi(() => ({ body: { id: 'new' } }))
    const w = mountForm()

    await fill(w, '')

    expect('budget' in calls(fetchMock)[0].body).toBe(false)
  })

  it('refuse un montant invalide sans appeler l\'API', async () => {
    const fetchMock = mockApi(() => ({ body: {} }))
    const w = mountForm()

    await fill(w, 'beaucoup')

    expect(w.text()).toContain('Montant invalide')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(w.emitted('saved')).toBeUndefined()
  })

  it('refuse un budget négatif ou nul', async () => {
    const fetchMock = mockApi(() => ({ body: {} }))
    const w = mountForm()

    await fill(w, '0')

    expect(w.text()).toContain('Montant invalide')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('en modification : préremplit le budget en euros', () => {
    const w = mountForm({ category: { ...TRANSPORT, budget: 12050 } })

    expect(w.find('#category-budget').element.value).toBe('120,5')
  })

  it('en modification : vider le champ envoie null pour retirer le budget', async () => {
    const fetchMock = mockApi(() => ({ body: { ...TRANSPORT, budget: null } }))
    const w = mountForm({ category: { ...TRANSPORT, budget: 12050 } })

    await w.find('#category-budget').setValue('')
    await submit(w)

    expect(calls(fetchMock)[0]).toMatchObject({ method: 'PUT', body: { budget: null } })
  })

  it('en modification : changer le budget l\'envoie', async () => {
    const fetchMock = mockApi(() => ({ body: { ...TRANSPORT, budget: 20000 } }))
    const w = mountForm({ category: { ...TRANSPORT, budget: 12050 } })

    await w.find('#category-budget').setValue('200')
    await submit(w)

    expect(calls(fetchMock)[0].body.budget).toBe(20000)
  })
})

