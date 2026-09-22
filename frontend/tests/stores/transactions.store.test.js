/**
 * Tests store — transactions (pagination, filtres, mutations)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTransactionsStore, PAGE_SIZE } from '@/stores/transactions.store.js'

function tx(n) {
  return { id: `t${n}`, title: `Opération ${n}`, amount: 1000, date: '2026-09-01', type: 'expense', note: null, category: null }
}

const page = (from, count) => Array.from({ length: count }, (_, i) => tx(from + i))

function mockFetch(handler) {
  const fetchMock = vi.fn(async (url) => {
    const { body, ok = true, status = 200 } = handler(new URL(url))
    return { ok, status, json: async () => body }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const urlsCalled = (fetchMock) => fetchMock.mock.calls.map(([url]) => new URL(url))

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('transactions.store — première page', () => {
  it('demande une page de PAGE_SIZE transactions', async () => {
    const fetchMock = mockFetch(() => ({ body: { items: page(1, 3), total: 3 } }))
    await useTransactionsStore().fetchAll()

    expect(urlsCalled(fetchMock)[0].searchParams.get('limit')).toBe(String(PAGE_SIZE))
    expect(urlsCalled(fetchMock)[0].searchParams.has('offset')).toBe(false)
  })

  it('reporte les filtres actifs dans la requête', async () => {
    const fetchMock = mockFetch(() => ({ body: { items: [], total: 0 } }))
    const store = useTransactionsStore()

    await store.setFilter('type', 'income')
    await store.setDateRange({ from: '2026-09-01', to: '2026-09-30' })

    const last = urlsCalled(fetchMock).at(-1).searchParams
    expect(last.get('type')).toBe('income')
    expect(last.get('from')).toBe('2026-09-01')
    expect(last.get('to')).toBe('2026-09-30')
  })

  it('n\'a rien à charger quand tout tient dans la première page', async () => {
    mockFetch(() => ({ body: { items: page(1, 3), total: 3 } }))
    const store = useTransactionsStore()
    await store.fetchAll()

    expect(store.hasMore).toBe(false)
    expect(store.remaining).toBe(0)
  })
})

describe('transactions.store — loadMore', () => {
  it('signale les transactions restantes', async () => {
    mockFetch(() => ({ body: { items: page(1, PAGE_SIZE), total: 120 } }))
    const store = useTransactionsStore()
    await store.fetchAll()

    expect(store.hasMore).toBe(true)
    expect(store.remaining).toBe(70)
  })

  it('demande la page suivante avec le bon offset et l\'ajoute à la suite', async () => {
    const fetchMock = mockFetch((url) => (
      url.searchParams.get('offset') === String(PAGE_SIZE)
        ? { body: { items: page(PAGE_SIZE + 1, 20), total: 70 } }
        : { body: { items: page(1, PAGE_SIZE), total: 70 } }
    ))
    const store = useTransactionsStore()
    await store.fetchAll()

    await store.loadMore()

    expect(urlsCalled(fetchMock).at(-1).searchParams.get('offset')).toBe(String(PAGE_SIZE))
    expect(store.items).toHaveLength(70)
    expect(store.items[0].id).toBe('t1')
    expect(store.items.at(-1).id).toBe('t70')
    expect(store.hasMore).toBe(false)
  })

  it('garde les filtres pour les pages suivantes', async () => {
    const fetchMock = mockFetch(() => ({ body: { items: page(1, PAGE_SIZE), total: 200 } }))
    const store = useTransactionsStore()
    await store.setFilter('type', 'expense')

    await store.loadMore()

    expect(urlsCalled(fetchMock).at(-1).searchParams.get('type')).toBe('expense')
  })

  it('ne fait aucun appel quand il n\'y a plus rien à charger', async () => {
    const fetchMock = mockFetch(() => ({ body: { items: page(1, 3), total: 3 } }))
    const store = useTransactionsStore()
    await store.fetchAll()

    await store.loadMore()

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('ignore un second appel pendant un chargement', async () => {
    let release
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: page(1, PAGE_SIZE), total: 120 }) })
      .mockImplementationOnce(() => new Promise((resolve) => { release = resolve }))
    vi.stubGlobal('fetch', fetchMock)
    const store = useTransactionsStore()
    await store.fetchAll()

    const first  = store.loadMore()
    const second = store.loadMore()
    release({ ok: true, json: async () => ({ items: page(PAGE_SIZE + 1, PAGE_SIZE), total: 120 }) })
    await Promise.all([first, second])

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(store.items).toHaveLength(PAGE_SIZE * 2)
  })

  it('repart de la première page quand un filtre change', async () => {
    mockFetch((url) => (
      url.searchParams.get('type') === 'income'
        ? { body: { items: page(900, 2), total: 2 } }
        : { body: { items: page(1, PAGE_SIZE), total: 120 } }
    ))
    const store = useTransactionsStore()
    await store.fetchAll()
    await store.loadMore()

    await store.setFilter('type', 'income')

    expect(store.items).toHaveLength(2)
    expect(store.hasMore).toBe(false)
  })

  it('expose l\'erreur et garde la liste déjà chargée', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: page(1, PAGE_SIZE), total: 120 }) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'Erreur serveur' }) })
    vi.stubGlobal('fetch', fetchMock)
    const store = useTransactionsStore()
    await store.fetchAll()

    await expect(store.loadMore()).rejects.toThrow('Erreur serveur')

    expect(store.error).toBe('Erreur serveur')
    expect(store.items).toHaveLength(PAGE_SIZE)
    expect(store.loadingMore).toBe(false)
  })
})

describe('transactions.store — mutations', () => {
  it('create ajoute en tête et incrémente le total', async () => {
    mockFetch(() => ({ body: tx(99), status: 201 }))
    const store = useTransactionsStore()
    store.items = page(1, 2)
    store.total = 2

    await store.create({ title: 'x' })

    expect(store.items[0].id).toBe('t99')
    expect(store.total).toBe(3)
  })

  it('remove retire la ligne et décrémente le total', async () => {
    mockFetch(() => ({ body: { id: 't1', deleted: true } }))
    const store = useTransactionsStore()
    store.items = page(1, 2)
    store.total = 2

    await store.remove('t1')

    expect(store.items.map((t) => t.id)).toEqual(['t2'])
    expect(store.total).toBe(1)
  })

  it('remove garde offset et total cohérents pour la page suivante', async () => {
    const fetchMock = mockFetch((url) => (
      url.pathname.endsWith('/t1') ? { body: { deleted: true } } : { body: { items: [], total: 119 } }
    ))
    const store = useTransactionsStore()
    store.items = page(1, PAGE_SIZE)
    store.total = 120

    await store.remove('t1')
    await store.loadMore()

    // 49 lignes chargées, 119 au total → la page suivante démarre bien à 49
    expect(urlsCalled(fetchMock).at(-1).searchParams.get('offset')).toBe(String(PAGE_SIZE - 1))
  })
})

describe('transactions.store — recherche', () => {
  const named = (n, title, extra = {}) => ({ ...tx(n), title, ...extra })

  it('filtre les transactions chargées sans rappeler l\'API', async () => {
    const fetchMock = mockFetch(() => ({ body: { items: [named(1, 'Café'), named(2, 'Loyer')], total: 2 } }))
    const store = useTransactionsStore()
    await store.fetchAll()

    await store.setSearch('cafe')

    expect(store.visibleItems.map((t) => t.title)).toEqual(['Café'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('ne réclame jamais la recherche au serveur (libellés chiffrés)', async () => {
    const fetchMock = mockFetch(() => ({ body: { items: [], total: 0 } }))
    const store = useTransactionsStore()

    await store.setSearch('cafe')
    await store.fetchAll()

    for (const url of urlsCalled(fetchMock)) {
      expect([...url.searchParams.keys()]).not.toContain('search')
      expect(url.search).not.toContain('cafe')
    }
  })

  it('charge toutes les pages restantes pour chercher sur l\'ensemble', async () => {
    const total = PAGE_SIZE * 2 + 10
    mockFetch((url) => {
      const offset = Number(url.searchParams.get('offset') ?? 0)
      return { body: { items: page(offset + 1, Math.min(PAGE_SIZE, total - offset)), total } }
    })
    const store = useTransactionsStore()
    await store.fetchAll()
    expect(store.items).toHaveLength(PAGE_SIZE)

    await store.setSearch('opération')

    expect(store.items).toHaveLength(total)
    expect(store.hasMore).toBe(false)
  })

  it('sans recherche, rien de plus n\'est chargé', async () => {
    const fetchMock = mockFetch(() => ({ body: { items: page(1, PAGE_SIZE), total: PAGE_SIZE * 2 } }))
    const store = useTransactionsStore()
    await store.fetchAll()

    await store.setSearch('   ')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(store.visibleItems).toHaveLength(PAGE_SIZE)
  })

  it('recharge le reste des pages quand un filtre change pendant une recherche', async () => {
    const total = PAGE_SIZE + 5
    const fetchMock = mockFetch((url) => {
      const offset = Number(url.searchParams.get('offset') ?? 0)
      return { body: { items: page(offset + 1, Math.min(PAGE_SIZE, total - offset)), total } }
    })
    const store = useTransactionsStore()
    store.search = 'opération'

    await store.setFilter('type', 'expense')
    await vi.waitFor(() => expect(store.items).toHaveLength(total))

    expect(urlsCalled(fetchMock).at(-1).searchParams.get('offset')).toBe(String(PAGE_SIZE))
  })

  it('compte la recherche comme un filtre actif, et resetFilters l\'efface', async () => {
    mockFetch(() => ({ body: { items: [], total: 0 } }))
    const store = useTransactionsStore()
    expect(store.hasFilters).toBe(false)

    await store.setSearch('cafe')
    expect(store.hasFilters).toBe(true)

    await store.resetFilters()
    expect(store.search).toBe('')
    expect(store.hasFilters).toBe(false)
  })

  it('n\'ajoute pas une page qui appartient à une ancienne liste (filtre changé entre-temps)', async () => {
    let release
    const fetchMock = vi.fn((url) => {
      const u = new URL(url)
      if (u.searchParams.get('offset')) {
        return new Promise((resolve) => { release = () => resolve({ ok: true, status: 200, json: async () => ({ items: page(100, 5), total: 60 }) }) })
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ items: page(1, PAGE_SIZE), total: 60 }) })
    })
    vi.stubGlobal('fetch', fetchMock)
    const store = useTransactionsStore()
    await store.fetchAll()

    const pending = store.loadMore()
    store.filters.type = 'income'
    release()
    await pending

    expect(store.items).toHaveLength(PAGE_SIZE)
  })
})

describe('transactions.store — résumé par mois', () => {
  it('sans mois : demande le mois courant (aucun paramètre)', async () => {
    const fetchMock = mockFetch(() => ({ body: { balance: 0, month: '2026-09' } }))

    await useTransactionsStore().fetchSummary()

    expect(urlsCalled(fetchMock)[0].search).toBe('')
  })

  it('avec un mois : le transmet', async () => {
    const fetchMock = mockFetch(() => ({ body: { balance: 0, month: '2026-03' } }))

    await useTransactionsStore().fetchSummary({ month: '2026-03' })

    expect(urlsCalled(fetchMock)[0].searchParams.get('month')).toBe('2026-03')
  })

  it('range les bornes de navigation avec le reste du résumé', async () => {
    mockFetch(() => ({ body: { balance: 5, month: '2026-03', currentMonth: '2026-09', firstMonth: '2026-01', recent: [] } }))
    const store = useTransactionsStore()

    await store.fetchSummary({ month: '2026-03' })

    expect(store.summary).toMatchObject({ month: '2026-03', currentMonth: '2026-09', firstMonth: '2026-01' })
  })

  it('l\'état initial connaît déjà ces champs', () => {
    expect(useTransactionsStore().summary).toMatchObject({ currentMonth: '', firstMonth: null })
  })
})

