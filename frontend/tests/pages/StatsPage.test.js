/**
 * Tests page — StatsPage (filtres, période, états vide / rempli)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import StatsPage from '@/pages/StatsPage.vue'
import { todayISO } from '@/utils/format.js'

// Chart.js a besoin d'un vrai canvas : on le remplace par des coquilles.
vi.mock('@/components/molecules/TimeseriesChart.vue', () => ({ default: { template: '<div data-test="timeseries" />' } }))
vi.mock('@/components/molecules/CategoryDoughnutChart.vue', () => ({ default: { template: '<div data-test="doughnut" />' } }))

const MONTH = todayISO().slice(0, 7)

const STATS = {
  from: `${MONTH}-01`, to: `${MONTH}-30`, type: 'expense', total: 40000,
  categories: [
    { id: 'food', name: 'Alimentation', color: '#4ade80', amount: 40000, percentage: 100, children: [] },
  ],
  timeseries: [{ date: `${MONTH}-05`, amount: 40000 }],
}
const EMPTY = { ...STATS, total: 0, categories: [], timeseries: [] }

function mockApi(stats = STATS) {
  const fetchMock = vi.fn(async (url) => {
    const { pathname } = new URL(url)
    const body = pathname === '/api/stats/periods' ? { months: [MONTH, '2025-01'], years: ['2026', '2025'] } : stats
    return { ok: true, status: 200, json: async () => body }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const statsCalls = (fetchMock) =>
  fetchMock.mock.calls.map(([url]) => new URL(url)).filter((u) => u.pathname === '/api/stats')

/** Chaque chargement demande la période affichée puis la période de comparaison : on les sépare. */
const latestLoad = (fetchMock) => {
  const list = statsCalls(fetchMock)
  return { current: list.at(-2).searchParams, previous: list.at(-1).searchParams }
}

beforeEach(() => vi.unstubAllGlobals())

describe('StatsPage', () => {
  it('charge le mois courant, en dépenses, au démarrage', async () => {
    const fetchMock = mockApi()
    mount(StatsPage)
    await flushPromises()

    const [first] = statsCalls(fetchMock)
    expect(first.searchParams.get('type')).toBe('expense')
    expect(first.searchParams.get('from')).toBe(`${MONTH}-01`)
    expect(first.searchParams.get('to')).toMatch(new RegExp(`^${MONTH}-\\d{2}$`))
    expect(statsCalls(fetchMock)).toHaveLength(2) // + la période de comparaison
  })

  it('affiche le total, les graphiques et le détail par catégorie', async () => {
    mockApi()
    const w = mount(StatsPage)
    await flushPromises()

    expect(w.text()).toContain('Total dépenses')
    expect(w.text()).toContain('400,00')
    expect(w.find('[data-test="timeseries"]').exists()).toBe(true)
    expect(w.find('[data-test="doughnut"]').exists()).toBe(true)
    expect(w.text()).toContain('Alimentation')
  })

  it('période sans transaction : message dédié, ni graphique ni détail', async () => {
    mockApi(EMPTY)
    const w = mount(StatsPage)
    await flushPromises()

    expect(w.text()).toContain('Aucune dépense sur cette période.')
    expect(w.find('[data-test="timeseries"]').exists()).toBe(false)
    expect(w.findAll('.category-stat')).toHaveLength(0)
  })

  it('passer aux revenus recharge avec le bon type', async () => {
    const fetchMock = mockApi()
    const w = mount(StatsPage)
    await flushPromises()

    await w.findAll('button').find((b) => b.text() === 'Revenus').trigger('click')
    await flushPromises()

    const { current, previous } = latestLoad(fetchMock)
    expect(current.get('type')).toBe('income')
    expect(previous.get('type')).toBe('income')
    expect(w.text()).toContain('Total revenus')
  })

  it('la vue Année couvre l\'année entière', async () => {
    const fetchMock = mockApi()
    const w = mount(StatsPage)
    await flushPromises()

    await w.findAll('button').find((b) => b.text() === 'Année').trigger('click')
    await flushPromises()

    const { current } = latestLoad(fetchMock)
    expect(current.get('from')).toBe(`${MONTH.slice(0, 4)}-01-01`)
    expect(current.get('to')).toBe(`${MONTH.slice(0, 4)}-12-31`)
  })

  it('la vue Personnalisé recharge quand une date change', async () => {
    const fetchMock = mockApi()
    const w = mount(StatsPage)
    await flushPromises()

    await w.findAll('button').find((b) => b.text() === 'Personnalisé').trigger('click')
    await flushPromises()
    await w.findAll('input[type="date"]')[0].setValue(`${MONTH}-03`)
    await flushPromises()

    expect(latestLoad(fetchMock).current.get('from')).toBe(`${MONTH}-03`)
  })
})

describe('StatsPage — comparaison avec la période précédente', () => {
  const TODAY = new Date(2026, 8, 21, 12) // 21 septembre 2026

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(TODAY)
  })
  afterEach(() => vi.useRealTimers())

  /** Répond selon la période demandée : `totals` associe le début de période au total. */
  function mockByPeriod(totals) {
    const fetchMock = vi.fn(async (url) => {
      const u = new URL(url)
      if (u.pathname === '/api/stats/periods') {
        return { ok: true, status: 200, json: async () => ({ months: ['2026-09', '2026-08'], years: ['2026', '2025'] }) }
      }
      const total = totals[u.searchParams.get('from')] ?? 0
      const body = total ? { ...STATS, total, categories: STATS.categories } : EMPTY
      return { ok: true, status: 200, json: async () => ({ ...body, total }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('compare le mois en cours au même nombre de jours du mois précédent', async () => {
    const fetchMock = mockByPeriod({ '2026-09-01': 40000, '2026-08-01': 30000 })
    mount(StatsPage)
    await flushPromises()

    const { current, previous } = latestLoad(fetchMock)
    expect([current.get('from'), current.get('to')]).toEqual(['2026-09-01', '2026-09-30'])
    expect([previous.get('from'), previous.get('to')]).toEqual(['2026-08-01', '2026-08-21'])
  })

  it('affiche l\'écart : pourcentage, sens et période comparée', async () => {
    mockByPeriod({ '2026-09-01': 40000, '2026-08-01': 30000 })
    const w = mount(StatsPage)
    await flushPromises()

    const trend = w.find('.trend__visual').text()
    expect(trend).toContain('▲')
    expect(trend).toContain('+33,3 %')
    expect(trend).toContain('vs août, au 21')
  })

  it('une dépense qui augmente est signalée défavorable, un revenu qui augmente favorable', async () => {
    mockByPeriod({ '2026-09-01': 40000, '2026-08-01': 30000 })
    const w = mount(StatsPage)
    await flushPromises()
    expect(w.find('.trend').classes()).toContain('trend--bad')

    await w.findAll('button').find((b) => b.text() === 'Revenus').trigger('click')
    await flushPromises()
    expect(w.find('.trend').classes()).toContain('trend--good')
  })

  it('une dépense qui baisse est favorable', async () => {
    mockByPeriod({ '2026-09-01': 20000, '2026-08-01': 30000 })
    const w = mount(StatsPage)
    await flushPromises()

    expect(w.find('.trend').classes()).toContain('trend--good')
    expect(w.find('.trend__visual').text()).toMatch(/▼\s*[-−]33,3 %/)
  })

  it('sans donnée le mois précédent : le dit au lieu d\'inventer un pourcentage', async () => {
    mockByPeriod({ '2026-09-01': 40000 })
    const w = mount(StatsPage)
    await flushPromises()

    expect(w.find('.trend__visual').text()).toContain('Pas de données en août')
    expect(w.find('.trend__visual').text()).not.toContain('%')
  })

  it('rien à comparer sur les deux périodes : aucun indicateur', async () => {
    mockByPeriod({})
    const w = mount(StatsPage)
    await flushPromises()

    expect(w.find('.trend').exists()).toBe(false)
  })

  it('la vue Année compare à l\'année précédente à la même date', async () => {
    const fetchMock = mockByPeriod({ '2026-01-01': 90000, '2025-01-01': 60000 })
    const w = mount(StatsPage)
    await flushPromises()

    await w.findAll('button').find((b) => b.text() === 'Année').trigger('click')
    await flushPromises()

    const { current, previous } = latestLoad(fetchMock)
    expect([current.get('from'), current.get('to')]).toEqual(['2026-01-01', '2026-12-31'])
    expect([previous.get('from'), previous.get('to')]).toEqual(['2025-01-01', '2025-09-21'])
    expect(w.find('.trend__visual').text()).toContain('+50 %')
  })

  it('un échec de la période précédente masque la comparaison, sans erreur affichée', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const u = new URL(url)
      if (u.pathname === '/api/stats/periods') return { ok: true, status: 200, json: async () => ({ months: [], years: [] }) }
      if (u.searchParams.get('from') === '2026-08-01') return { ok: false, status: 500, json: async () => ({ error: 'boom' }) }
      return { ok: true, status: 200, json: async () => STATS }
    }))
    const w = mount(StatsPage)
    await flushPromises()

    expect(w.find('.trend').exists()).toBe(false)
    expect(w.find('[role="alert"]').exists()).toBe(false)
    expect(w.text()).toContain('Alimentation')
  })
})

