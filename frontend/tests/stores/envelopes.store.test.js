/**
 * Tests store — envelopes (cache, CRUD)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useEnvelopesStore } from '@/stores/envelopes.store.js'
import { mockApi, calls } from './_helpers.js'

const env = (id, name, extra = {}) => ({ id, name, budget: 40000, categoryIds: [], ...extra })

const FOOD  = env('food', 'Vie quotidienne', { categoryIds: ['a', 'b'] })
const ALL   = [FOOD]

beforeEach(() => vi.unstubAllGlobals())

describe('envelopes.store — chargement', () => {
  it('charge les enveloppes une seule fois (cache)', async () => {
    const fetchMock = mockApi(() => ({ body: ALL }))
    const store = useEnvelopesStore()

    await store.fetchAll()
    await store.fetchAll()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(store.loaded).toBe(true)
    expect(store.items).toHaveLength(1)
  })

  it('force recharge malgré le cache', async () => {
    const fetchMock = mockApi(() => ({ body: ALL }))
    const store = useEnvelopesStore()

    await store.fetchAll()
    await store.fetchAll({ force: true })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('expose l\'erreur, reste « non chargé »', async () => {
    mockApi(() => ({ ok: false, status: 500, body: { error: 'Erreur serveur.' } }))
    const store = useEnvelopesStore()

    await expect(store.fetchAll()).rejects.toThrow('Erreur serveur.')

    expect(store.error).toBe('Erreur serveur.')
    expect(store.loaded).toBe(false)
  })
})

describe('envelopes.store — getters', () => {
  it('byId retrouve une enveloppe, ou null', () => {
    const store = useEnvelopesStore()
    store.items = ALL

    expect(store.byId('food').name).toBe('Vie quotidienne')
    expect(store.byId('nope')).toBeNull()
  })
})

describe('envelopes.store — mutations', () => {
  it('create poste l\'enveloppe et l\'ajoute à la liste', async () => {
    const fetchMock = mockApi(() => ({ body: env('new', 'Loisirs') }))
    const store = useEnvelopesStore()

    await store.create({ name: 'Loisirs', budget: 40000, categoryIds: ['a'] })

    expect(calls(fetchMock)[0]).toMatchObject({
      method: 'POST', path: '/api/envelopes', body: { name: 'Loisirs', budget: 40000, categoryIds: ['a'] },
    })
    expect(store.items.map((e) => e.id)).toEqual(['new'])
  })

  it('create sans categoryIds envoie un tableau vide par défaut', async () => {
    const fetchMock = mockApi(() => ({ body: env('new', 'Loisirs', { categoryIds: [] }) }))

    await useEnvelopesStore().create({ name: 'Loisirs', budget: 40000 })

    expect(calls(fetchMock)[0].body.categoryIds).toEqual([])
  })

  it('update remplace l\'enveloppe en place', async () => {
    mockApi(() => ({ body: env('food', 'Quotidien') }))
    const store = useEnvelopesStore()
    store.items = [{ ...FOOD }]

    await store.update('food', { name: 'Quotidien' })

    expect(store.items[0].name).toBe('Quotidien')
  })

  it('remove supprime côté API puis retire l\'enveloppe de la liste', async () => {
    const fetchMock = mockApi(() => ({ body: { deleted: true } }))
    const store = useEnvelopesStore()
    store.items = [...ALL]

    await store.remove('food')

    expect(calls(fetchMock)[0]).toMatchObject({ method: 'DELETE', path: '/api/envelopes/food' })
    expect(store.items).toEqual([])
  })
})
