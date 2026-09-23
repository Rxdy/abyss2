/**
 * Tests store — recurring (charges fixes : chargement, bascule, totaux)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useRecurringStore } from '@/stores/recurring.store.js'
import { mockApi, calls } from './_helpers.js'

const rec = (id, over = {}) => ({
  id, title: `Charge ${id}`, amount: 1000, type: 'expense', dayOfMonth: 5, active: true, ...over,
})

beforeEach(() => vi.unstubAllGlobals())

describe('recurring.store — chargement', () => {
  it('charge une seule fois, sauf force', async () => {
    const fetchMock = mockApi(() => ({ body: [rec('a')] }))
    const store = useRecurringStore()

    await store.fetchAll()
    await store.fetchAll()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await store.fetchAll({ force: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('expose l\'erreur et relance', async () => {
    mockApi(() => ({ ok: false, status: 500, body: { error: 'Erreur serveur.' } }))
    const store = useRecurringStore()

    await expect(store.fetchAll()).rejects.toThrow('Erreur serveur.')

    expect(store.error).toBe('Erreur serveur.')
    expect(store.loaded).toBe(false)
  })
})

describe('recurring.store — getters', () => {
  it('sépare actives et en pause', () => {
    const store = useRecurringStore()
    store.items = [rec('a'), rec('b', { active: false }), rec('c')]

    expect(store.active.map((i) => i.id)).toEqual(['a', 'c'])
    expect(store.paused.map((i) => i.id)).toEqual(['b'])
  })

  it('monthlyNet : revenus fixes moins dépenses fixes, actives seulement', () => {
    const store = useRecurringStore()
    store.items = [
      rec('rent',   { amount: 78800 }),
      rec('salary', { amount: 200000, type: 'income' }),
      rec('paused', { amount: 5000, active: false }),
    ]

    expect(store.monthlyNet).toBe(200000 - 78800)
  })

  it('monthlyNet vaut 0 sans charge', () => {
    expect(useRecurringStore().monthlyNet).toBe(0)
  })
})

describe('recurring.store — mutations', () => {
  it('create poste et ajoute à la liste', async () => {
    const fetchMock = mockApi(() => ({ body: rec('new') }))
    const store = useRecurringStore()

    await store.create({ title: 'Loyer', amount: 78800 })

    expect(calls(fetchMock)[0]).toMatchObject({ method: 'POST', path: '/api/recurring', body: { title: 'Loyer', amount: 78800 } })
    expect(store.items.map((i) => i.id)).toEqual(['new'])
  })

  it('update remplace l\'élément en place', async () => {
    mockApi(() => ({ body: rec('a', { amount: 2000 }) }))
    const store = useRecurringStore()
    store.items = [rec('a'), rec('b')]

    await store.update('a', { amount: 2000 })

    expect(store.items[0].amount).toBe(2000)
    expect(store.items).toHaveLength(2)
  })

  it('toggleActive envoie l\'inverse de l\'état courant', async () => {
    const fetchMock = mockApi(() => ({ body: rec('a', { active: false }) }))
    const store = useRecurringStore()
    store.items = [rec('a')]

    await store.toggleActive(store.items[0])

    expect(calls(fetchMock)[0]).toMatchObject({ method: 'PUT', path: '/api/recurring/a', body: { active: false } })
    expect(store.items[0].active).toBe(false)
  })

  it('remove supprime côté API puis retire de la liste', async () => {
    const fetchMock = mockApi(() => ({ body: { deleted: true } }))
    const store = useRecurringStore()
    store.items = [rec('a'), rec('b')]

    await store.remove('a')

    expect(calls(fetchMock)[0]).toMatchObject({ method: 'DELETE', path: '/api/recurring/a' })
    expect(store.items.map((i) => i.id)).toEqual(['b'])
  })

  it('garde la liste intacte si la suppression échoue', async () => {
    mockApi(() => ({ ok: false, status: 404, body: { error: 'Introuvable.' } }))
    const store = useRecurringStore()
    store.items = [rec('a')]

    await expect(store.remove('a')).rejects.toThrow('Introuvable.')

    expect(store.items).toHaveLength(1)
  })
})
