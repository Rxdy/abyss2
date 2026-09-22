/**
 * Tests store — stats (répartition par catégorie, périodes disponibles)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStatsStore } from '@/stores/stats.store.js'
import { mockApi, calls } from './_helpers.js'

const STATS = {
  from: '2026-09-01', to: '2026-09-30', type: 'expense', total: 5000,
  categories: [{ id: 'c1', name: 'Courses', amount: 5000, percentage: 100, children: [] }],
  timeseries: [{ date: '2026-09-05', amount: 5000 }],
}

beforeEach(() => vi.unstubAllGlobals())

describe('stats.store — fetch', () => {
  it('demande la période et le type, puis range la réponse', async () => {
    const fetchMock = mockApi(() => ({ body: STATS }))
    const store = useStatsStore()

    await store.fetch({ from: '2026-09-01', to: '2026-09-30', type: 'income' })

    expect(calls(fetchMock)[0].path).toBe('/api/stats?from=2026-09-01&to=2026-09-30&type=income')
    expect(store.data).toEqual(STATS)
    expect(store.loading).toBe(false)
  })

  it('le type par défaut est « dépense »', async () => {
    const fetchMock = mockApi(() => ({ body: STATS }))

    await useStatsStore().fetch({ from: '2026-09-01', to: '2026-09-30' })

    expect(calls(fetchMock)[0].path).toContain('type=expense')
  })

  it('en cas d\'erreur : expose le message, vide les données et relance l\'erreur', async () => {
    mockApi(() => ({ ok: false, status: 400, body: { error: 'Période invalide.' } }))
    const store = useStatsStore()
    store.data = STATS

    await expect(store.fetch({ from: '2026-09-30', to: '2026-09-01' })).rejects.toThrow('Période invalide.')

    expect(store.error).toBe('Période invalide.')
    expect(store.data).toMatchObject({ total: 0, categories: [], timeseries: [], from: '2026-09-30', to: '2026-09-01' })
    expect(store.loading).toBe(false)
  })

  it('efface l\'erreur précédente au nouvel appel', async () => {
    const store = useStatsStore()
    store.error = 'ancienne erreur'
    mockApi(() => ({ body: STATS }))

    await store.fetch({ from: '2026-09-01', to: '2026-09-30' })

    expect(store.error).toBe('')
  })
})

describe('stats.store — fetchPeriods', () => {
  it('récupère les mois et années pour le type demandé', async () => {
    const periods = { months: ['2026-09', '2026-08'], years: ['2026'] }
    const fetchMock = mockApi(() => ({ body: periods }))
    const store = useStatsStore()

    await store.fetchPeriods({ type: 'income' })

    expect(calls(fetchMock)[0].path).toBe('/api/stats/periods?type=income')
    expect(store.periods).toEqual(periods)
  })

  it('reste silencieux en cas d\'erreur : listes vides, pas d\'exception', async () => {
    mockApi(() => ({ ok: false, status: 500, body: { error: 'boom' } }))
    const store = useStatsStore()
    store.periods = { months: ['2026-09'], years: ['2026'] }

    await expect(store.fetchPeriods({ type: 'expense' })).resolves.toEqual({ months: [], years: [] })

    expect(store.periods).toEqual({ months: [], years: [] })
  })
})

describe('stats.store — période de comparaison', () => {
  it('ne garde que le total de la période précédente', async () => {
    const fetchMock = mockApi(() => ({ body: { ...STATS, total: 42000 } }))
    const store = useStatsStore()

    await store.fetchPrevious({ from: '2026-08-01', to: '2026-08-31', type: 'income' })

    expect(calls(fetchMock)[0].path).toBe('/api/stats?from=2026-08-01&to=2026-08-31&type=income')
    expect(store.previous).toEqual({ from: '2026-08-01', to: '2026-08-31', type: 'income', total: 42000 })
  })

  it('n\'affecte ni les données courantes ni l\'erreur', async () => {
    mockApi(() => ({ body: { ...STATS, total: 1 } }))
    const store = useStatsStore()
    store.data = STATS

    await store.fetchPrevious({ from: '2026-08-01', to: '2026-08-31' })

    expect(store.data).toEqual(STATS)
    expect(store.error).toBe('')
  })

  it('un échec masque la comparaison sans erreur ni exception', async () => {
    mockApi(() => ({ ok: false, status: 500, body: { error: 'boom' } }))
    const store = useStatsStore()
    store.previous = { from: 'a', to: 'b', type: 'expense', total: 5 }

    await expect(store.fetchPrevious({ from: '2026-08-01', to: '2026-08-31' })).resolves.toBeNull()

    expect(store.previous).toBeNull()
    expect(store.error).toBe('')
  })

  it('la comparaison est vidée dès qu\'on en redemande une (pas de chiffre périmé à l\'écran)', async () => {
    let release
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => {
      release = () => resolve({ ok: true, status: 200, json: async () => ({ ...STATS, total: 9 }) })
    })))
    const store = useStatsStore()
    store.previous = { from: 'a', to: 'b', type: 'expense', total: 5 }

    const pending = store.fetchPrevious({ from: '2026-08-01', to: '2026-08-31' })
    expect(store.previous).toBeNull()

    release()
    await pending
    expect(store.previous.total).toBe(9)
  })

  it('une réponse arrivée trop tard est ignorée (deux requêtes qui se doublent)', async () => {
    const resolvers = []
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { resolvers.push(resolve) })))
    const store = useStatsStore()

    const first  = store.fetchPrevious({ from: '2026-07-01', to: '2026-07-31' })
    const second = store.fetchPrevious({ from: '2026-08-01', to: '2026-08-31' })
    resolvers[1]({ ok: true, status: 200, json: async () => ({ ...STATS, total: 200 }) })
    await second
    resolvers[0]({ ok: true, status: 200, json: async () => ({ ...STATS, total: 100 }) })
    await first

    expect(store.previous.total).toBe(200)
  })

  it('même protection pour les données courantes', async () => {
    const resolvers = []
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { resolvers.push(resolve) })))
    const store = useStatsStore()

    const first  = store.fetch({ from: '2026-07-01', to: '2026-07-31' })
    const second = store.fetch({ from: '2026-08-01', to: '2026-08-31' })
    resolvers[1]({ ok: true, status: 200, json: async () => ({ ...STATS, total: 200 }) })
    await second
    resolvers[0]({ ok: true, status: 200, json: async () => ({ ...STATS, total: 100 }) })
    await first

    expect(store.data.total).toBe(200)
    expect(store.loading).toBe(false)
  })
})

