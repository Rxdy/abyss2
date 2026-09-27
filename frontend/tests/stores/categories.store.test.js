/**
 * Tests store — categories (cache, hiérarchie, suppression, réordonnancement)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCategoriesStore } from '@/stores/categories.store.js'
import { mockApi, calls } from './_helpers.js'

const cat = (id, name, extra = {}) => ({ id, name, color: '#4ade80', position: 0, parentId: null, ...extra })

const FOOD    = cat('food', 'Alimentation', { position: 0 })
const RESTO   = cat('resto', 'Restaurants', { parentId: 'food' })
const COURSES = cat('courses', 'Courses', { parentId: 'food', position: 1 })
const TRANSPORT = cat('transport', 'Transport', { position: 1 })
const ALL = [FOOD, TRANSPORT, RESTO, COURSES]

beforeEach(() => vi.unstubAllGlobals())

describe('categories.store — chargement', () => {
  it('charge les catégories une seule fois (cache)', async () => {
    const fetchMock = mockApi(() => ({ body: ALL }))
    const store = useCategoriesStore()

    await store.fetchAll()
    await store.fetchAll()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(store.loaded).toBe(true)
    expect(store.items).toHaveLength(4)
  })

  it('force recharge malgré le cache', async () => {
    const fetchMock = mockApi(() => ({ body: ALL }))
    const store = useCategoriesStore()

    await store.fetchAll()
    await store.fetchAll({ force: true })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('expose l\'erreur, reste « non chargé » et relance', async () => {
    mockApi(() => ({ ok: false, status: 500, body: { error: 'Erreur serveur.' } }))
    const store = useCategoriesStore()

    await expect(store.fetchAll()).rejects.toThrow('Erreur serveur.')

    expect(store.error).toBe('Erreur serveur.')
    expect(store.loaded).toBe(false)
    expect(store.loading).toBe(false)
  })
})

describe('categories.store — getters', () => {
  function loaded() {
    const store = useCategoriesStore()
    store.items = ALL
    store.loaded = true
    return store
  }

  it('topLevel ne garde que les catégories principales', () => {
    expect(loaded().topLevel.map((c) => c.id)).toEqual(['food', 'transport'])
  })

  it('childrenOf renvoie les sous-catégories d\'un parent', () => {
    expect(loaded().childrenOf('food').map((c) => c.id)).toEqual(['resto', 'courses'])
    expect(loaded().childrenOf('transport')).toEqual([])
  })

  it('flatOptions liste chaque parent suivi de ses enfants indentés', () => {
    expect(loaded().flatOptions).toEqual([
      { id: 'food', label: 'Alimentation' },
      { id: 'resto', label: '↳ Restaurants' },
      { id: 'courses', label: '↳ Courses' },
      { id: 'transport', label: 'Transport' },
    ])
  })

  it('byId retrouve une catégorie, ou null', () => {
    const store = loaded()
    expect(store.byId('resto').name).toBe('Restaurants')
    expect(store.byId('nope')).toBeNull()
  })

  it('isEmpty : vrai seulement une fois chargé et vide', () => {
    const store = useCategoriesStore()
    expect(store.isEmpty).toBe(false)

    store.loaded = true
    expect(store.isEmpty).toBe(true)
  })
})

describe('categories.store — mutations', () => {
  it('create poste la catégorie (parentId null par défaut) et l\'ajoute à la liste', async () => {
    const fetchMock = mockApi(() => ({ body: cat('new', 'Loisirs') }))
    const store = useCategoriesStore()

    await store.create({ name: 'Loisirs', color: '#4ade80' })

    expect(calls(fetchMock)[0]).toMatchObject({
      method: 'POST', path: '/api/categories', body: { name: 'Loisirs', color: '#4ade80', parentId: null },
    })
    expect(store.items.map((c) => c.id)).toEqual(['new'])
  })

  it('update remplace la catégorie en place', async () => {
    mockApi(() => ({ body: cat('food', 'Nourriture') }))
    const store = useCategoriesStore()
    store.items = [{ ...FOOD }, { ...TRANSPORT }]

    await store.update('food', { name: 'Nourriture' })

    expect(store.items.map((c) => c.name)).toEqual(['Nourriture', 'Transport'])
  })

  it('remove envoie la recatégorisation puis recharge la liste', async () => {
    const fetchMock = mockApi(({ method }) => ({ body: method === 'DELETE' ? { deleted: true } : [TRANSPORT] }))
    const store = useCategoriesStore()
    store.items = ALL

    await store.remove('food', { reassignTo: 'transport' })

    const [del, refetch] = calls(fetchMock)
    expect(del).toMatchObject({ method: 'DELETE', path: '/api/categories/food', body: { reassignTo: 'transport' } })
    expect(refetch).toMatchObject({ method: 'GET', path: '/api/categories' })
    expect(store.items).toEqual([TRANSPORT])
  })

  it('remove sans recatégorisation envoie reassignTo: null', async () => {
    const fetchMock = mockApi(() => ({ body: [] }))

    await useCategoriesStore().remove('food')

    expect(calls(fetchMock)[0].body).toEqual({ reassignTo: null })
  })
})

describe('categories.store — reorder', () => {
  it('ne persiste que les positions qui changent, puis recharge', async () => {
    const a = cat('a', 'A', { position: 0 })
    const b = cat('b', 'B', { position: 1 })
    const c = cat('c', 'C', { position: 2 })
    const fetchMock = mockApi(({ method, url }) => ({
      body: method === 'PUT' ? cat(url.pathname.split('/').pop(), '?') : [c, b, a],
    }))
    const store = useCategoriesStore()
    store.items = [a, b, c]

    // A et C échangent leur place ; B ne bouge pas
    await store.reorder([c, b, a])

    const puts = calls(fetchMock).filter((call) => call.method === 'PUT')
    expect(puts.map((p) => [p.path, p.body])).toEqual(
      expect.arrayContaining([
        ['/api/categories/c', { position: 0 }],
        ['/api/categories/a', { position: 2 }],
      ]),
    )
    expect(puts).toHaveLength(2)
    expect(calls(fetchMock).at(-1)).toMatchObject({ method: 'GET', path: '/api/categories' })
  })

  it('ne fait aucun appel d\'écriture quand l\'ordre est inchangé', async () => {
    const a = cat('a', 'A', { position: 0 })
    const b = cat('b', 'B', { position: 1 })
    const fetchMock = mockApi(() => ({ body: [a, b] }))

    await useCategoriesStore().reorder([a, b])

    expect(calls(fetchMock).filter((call) => call.method === 'PUT')).toHaveLength(0)
  })
})

describe('categories.store — budget', () => {
  it('create transmet le budget quand il y en a un', async () => {
    const fetchMock = mockApi(() => ({ body: cat('new', 'Loisirs', { budget: 15000 }) }))

    await useCategoriesStore().create({ name: 'Loisirs', color: '#4ade80', budget: 15000 })

    expect(calls(fetchMock)[0].body).toMatchObject({ name: 'Loisirs', budget: 15000 })
  })

  it('create n\'envoie pas de budget quand il n\'y en a pas', async () => {
    const fetchMock = mockApi(() => ({ body: cat('new', 'Loisirs') }))

    await useCategoriesStore().create({ name: 'Loisirs', color: '#4ade80', budget: null })

    expect('budget' in calls(fetchMock)[0].body).toBe(false)
  })

  it('update conserve le budget renvoyé par l\'API', async () => {
    mockApi(() => ({ body: cat('food', 'Alimentation', { budget: 40000 }) }))
    const store = useCategoriesStore()
    store.items = [cat('food', 'Alimentation')]

    await store.update('food', { budget: 40000 })

    expect(store.items[0].budget).toBe(40000)
  })
})

