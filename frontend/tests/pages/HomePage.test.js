/**
 * Tests page — HomePage (tableau de bord budget : solde, revenus/dépenses
 * du mois, ajout rapide, dernières transactions)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises, DOMWrapper } from '@vue/test-utils'
import HomePage from '@/pages/HomePage.vue'
import { formatAmount } from '@/utils/format.js'

const SUMMARY = {
  balance: 12345,
  income: 60000,
  expense: 47655,
  monthIncome: 50000,
  monthExpense: 20000,
  month: '2026-09',
  currentMonth: '2026-09',
  firstMonth: '2026-03',
  count: 2,
  recent: [
    { id: '1', title: 'Salaire', amount: 50000, date: '2026-09-01', type: 'income', note: null, category: null },
    { id: '2', title: 'Courses', amount: 4500, date: '2026-09-03', type: 'expense', note: null, category: { id: 'c1', name: 'Alimentation', color: '#4ade80' } },
  ],
}

const STATS = {
  total: 45000,
  categories: [
    { id: 'c1', name: 'Alimentation', color: '#4ade80', amount: 36000, percentage: 80, children: [] },
    { id: 'c2', name: 'Loisirs', color: '#facc15', amount: 9000, percentage: 20, children: [] },
  ],
  timeseries: [{ date: '2026-09-03', amount: 45000 }],
}

const RECURRING = [
  { id: 'r1', title: 'Salaire', amount: 235000, type: 'income', active: true, nextDate: '2026-10-28' },
  { id: 'r2', title: 'Loyer', amount: 72000, type: 'expense', active: true, nextDate: '2026-10-05' },
  { id: 'r3', title: 'Netflix', amount: 1349, type: 'expense', active: true, nextDate: '2026-10-15' },
  { id: 'r4', title: 'Salle de sport', amount: 2990, type: 'expense', active: true, nextDate: '2026-10-20' },
  { id: 'r5', title: 'En pause', amount: 1000, type: 'expense', active: false, nextDate: null },
]

// Les composants Chart.js ont besoin d'un vrai canvas : coquille à la place.
vi.mock('@/components/molecules/TimeseriesChart.vue', () => ({
  default: { props: ['timeseries', 'type'], template: '<div data-test="month-chart" />' },
}))

/** Répond selon l'URL appelée ; renvoie le mock pour inspecter les requêtes. */
function mockApi({ summary = SUMMARY, categories = [], stats = STATS, recurring = [], envelopes = [] } = {}) {
  const fetchMock = vi.fn().mockImplementation((url) => {
    const { pathname, searchParams } = new URL(url)
    const body = pathname === '/api/categories' ? categories
      : pathname === '/api/envelopes' ? envelopes
      : pathname === '/api/recurring' ? recurring
      : pathname === '/api/stats' ? stats
      : { ...summary, month: searchParams.get('month') ?? summary.month } // comme l'API : le mois demandé
    return Promise.resolve({ ok: true, status: 200, json: async () => body })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const summaryCalls = (fetchMock) =>
  fetchMock.mock.calls.map(([url]) => new URL(url)).filter((u) => u.pathname === '/api/summary')

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('HomePage', () => {
  it('affiche le solde et les totaux du mois', async () => {
    mockApi()

    const w = mount(HomePage)
    await flushPromises()

    expect(w.text()).toContain(formatAmount(SUMMARY.balance))
    expect(w.text()).toContain(formatAmount(SUMMARY.monthIncome))
    expect(w.text()).toContain(formatAmount(SUMMARY.monthExpense))
  })

  it('signale une erreur si le résumé ne charge pas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Failed to fetch')))

    const w = mount(HomePage)
    await flushPromises()

    expect(w.find('[role="alert"]').text()).toContain('Failed to fetch')
  })

  it('liste les dernières transactions du résumé', async () => {
    mockApi()

    const w = mount(HomePage)
    await flushPromises()

    expect(w.text()).toContain('Salaire')
    expect(w.text()).toContain('Courses')
  })

  it('compte vide : invite à commencer', async () => {
    mockApi({ summary: { ...SUMMARY, recent: [], count: 0 } })

    const w = mount(HomePage)
    await flushPromises()

    expect(w.text()).toContain('Aucune transaction — commencez par en ajouter une.')
  })

  it('mois sans transaction dans un compte qui en a : le dit simplement', async () => {
    mockApi({ summary: { ...SUMMARY, recent: [], count: 40 } })

    const w = mount(HomePage)
    await flushPromises()

    expect(w.text()).toContain('Aucune transaction ce mois-ci.')
    expect(w.text()).not.toContain('commencez')
  })

  it('au repos, aucun formulaire à l\'écran', async () => {
    mockApi()

    const w = mount(HomePage, { attachTo: document.body })
    await flushPromises()

    expect(document.body.querySelector('#transaction-title')).toBeNull()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    w.unmount()
  })

  it('le bouton d\'ajout ouvre le formulaire dans une modale', async () => {
    mockApi()

    const w = mount(HomePage, { attachTo: document.body })
    await flushPromises()
    await w.find('button.home__add').trigger('click')

    expect(document.body.querySelector('[role="dialog"] #transaction-title')).not.toBeNull()
    w.unmount()
  })

  it('le bouton flottant ouvre aussi la modale', async () => {
    mockApi()

    const w = mount(HomePage, { attachTo: document.body })
    await flushPromises()
    await w.find('button[aria-label="Ajouter une transaction"]').trigger('click')

    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull()
    w.unmount()
  })

  it('toucher une transaction récente ouvre la modale préremplie', async () => {
    mockApi()

    const w = mount(HomePage, { attachTo: document.body })
    await flushPromises()
    await w.findAll('li button').find((b) => b.text().includes('Courses')).trigger('click')

    expect(document.body.querySelector('[role="dialog"]').textContent).toContain('Modifier la transaction')
    expect(new DOMWrapper(document.body.querySelector('#transaction-title')).element.value).toBe('Courses')
    w.unmount()
  })
})

describe('HomePage — navigation par mois', () => {
  const nav = (w, label) => w.find(`button[aria-label="${label}"]`)

  it('affiche le mois courant dans le sélecteur, sans mention « en cours » en dur', async () => {
    mockApi()

    const w = mount(HomePage)
    await flushPromises()

    expect(w.find('.month-nav').text()).toContain('Septembre 2026')
    expect(w.text()).not.toContain('Mois en cours —')
  })

  it('demande d\'abord le mois courant (sans paramètre), puis le mois choisi', async () => {
    const fetchMock = mockApi()
    const w = mount(HomePage)
    await flushPromises()
    expect(summaryCalls(fetchMock)[0].search).toBe('')

    await nav(w, 'Mois précédent').trigger('click')
    await flushPromises()

    expect(summaryCalls(fetchMock).at(-1).searchParams.get('month')).toBe('2026-08')
  })

  it('recharge aussi les statistiques du mois choisi (courbe et budgets)', async () => {
    const fetchMock = mockApi()
    const w = mount(HomePage)
    await flushPromises()

    await nav(w, 'Mois précédent').trigger('click')
    await flushPromises()

    const stats = fetchMock.mock.calls.map(([url]) => new URL(url)).filter((u) => u.pathname === '/api/stats').at(-1).searchParams
    expect([stats.get('from'), stats.get('to'), stats.get('type')]).toEqual(['2026-08-01', '2026-08-31', 'expense'])
  })

  it('respecte les bornes annoncées par l\'API : ni futur, ni avant la première transaction', async () => {
    mockApi({ summary: { ...SUMMARY, month: '2026-03', firstMonth: '2026-03' } })

    const w = mount(HomePage)
    await flushPromises()

    expect(nav(w, 'Mois précédent').attributes('disabled')).toBeDefined()

    mockApi()
    const current = mount(HomePage)
    await flushPromises()
    expect(nav(current, 'Mois suivant').attributes('disabled')).toBeDefined()
  })

  it('le solde global ne dépend pas du mois affiché', async () => {
    mockApi()
    const w = mount(HomePage)
    await flushPromises()

    expect(w.find('.balance__amount').text()).toBe(formatAmount(SUMMARY.balance))
  })
})

describe('HomePage — budgets', () => {
  const BUDGETED = [
    { id: 'c1', name: 'Alimentation', color: '#4ade80', budget: 40000, parentId: null },
    { id: 'c2', name: 'Loisirs', color: '#facc15', budget: 8000, parentId: null },
    { id: 'c3', name: 'Transport', color: '#38bdf8', budget: null, parentId: null },
  ]

  it('n\'affiche pas la rubrique tant qu\'aucune catégorie n\'a de budget', async () => {
    mockApi({ categories: [{ id: 'c1', name: 'Alimentation', budget: null }] })

    const w = mount(HomePage)
    await flushPromises()

    expect(w.text()).not.toContain('Budgets')
  })

  it('une jauge par catégorie budgétée, avec le dépensé du mois', async () => {
    mockApi({ categories: BUDGETED })

    const w = mount(HomePage)
    await flushPromises()

    expect(w.text()).toContain('Budgets')
    expect(w.findAll('.budget')).toHaveLength(2)
    expect(w.text()).toMatch(/360,00\s€\s\/\s400,00\s€/)
  })

  it('les plus avancées d\'abord, un dépassement signalé', async () => {
    mockApi({ categories: BUDGETED }) // Loisirs : 90 € sur 80 € → dépassé

    const w = mount(HomePage)
    await flushPromises()

    expect(w.findAll('.budget__name').map((n) => n.text())).toEqual(['Loisirs', 'Alimentation'])
    expect(w.text()).toMatch(/Dépassé de 10,00\s€/)
  })
})

describe('HomePage — enveloppes', () => {
  const ENVELOPES = [
    { id: 'e1', name: 'Vie quotidienne', budget: 40000, categoryIds: ['c1'] },
    { id: 'e2', name: 'Loisirs', budget: 8000, categoryIds: ['c2'] },
  ]

  it('n\'affiche pas la rubrique tant qu\'aucune enveloppe n\'existe', async () => {
    mockApi()

    const w = mount(HomePage)
    await flushPromises()

    expect(w.text()).not.toContain('Enveloppes')
  })

  it('une jauge par enveloppe, avec le dépensé cumulé de ses catégories', async () => {
    mockApi({ envelopes: ENVELOPES })

    const w = mount(HomePage)
    await flushPromises()

    expect(w.text()).toContain('Enveloppes')
    expect(w.findAll('.budget')).toHaveLength(2)
    // c1 (Alimentation) : 360 € dépensés — voir STATS
    expect(w.text()).toMatch(/360,00\s€\s\/\s400,00\s€/)
  })

  it('alerte quand le total alloué dépasse les revenus réels du mois, sans bloquer', async () => {
    mockApi({ envelopes: [{ id: 'e1', name: 'Trop', budget: 999999, categoryIds: [] }] })

    const w = mount(HomePage)
    await flushPromises()

    expect(w.find('[role="alert"]').text()).toContain('libre à vous de continuer')
    expect(w.findAll('.budget')).toHaveLength(1)
  })

  it('pas d\'alerte quand l\'allocation reste sous les revenus du mois', async () => {
    mockApi({ envelopes: ENVELOPES }) // 480 € alloués, 500 € de revenus (SUMMARY.monthIncome)

    const w = mount(HomePage)
    await flushPromises()

    expect(w.find('[role="alert"]').exists()).toBe(false)
  })
})

describe('HomePage — courbe du mois', () => {
  it('affiche la courbe des dépenses quand le mois en compte', async () => {
    mockApi()

    const w = mount(HomePage)
    await flushPromises()

    expect(w.text()).toContain('Dépenses du mois')
    expect(w.find('[data-test="month-chart"]').exists()).toBe(true)
  })

  it('pas de courbe pour un mois sans dépense', async () => {
    mockApi({ stats: { ...STATS, total: 0, categories: [], timeseries: [] } })

    const w = mount(HomePage)
    await flushPromises()

    expect(w.find('[data-test="month-chart"]').exists()).toBe(false)
    expect(w.text()).not.toContain('Dépenses du mois')
  })

  it('un échec des statistiques ne montre aucune erreur', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
      const { pathname } = new URL(url)
      if (pathname === '/api/stats') return Promise.resolve({ ok: false, status: 500, json: async () => ({ error: 'boom' }) })
      return Promise.resolve({ ok: true, status: 200, json: async () => (['/api/categories', '/api/recurring', '/api/envelopes'].includes(pathname) ? [] : SUMMARY) })
    }))

    const w = mount(HomePage)
    await flushPromises()

    expect(w.find('[role="alert"]').exists()).toBe(false)
    expect(w.text()).toContain('Salaire')
  })
})

describe('HomePage — prochaines échéances', () => {
  it('liste les 3 prochaines, dans l\'ordre des dates', async () => {
    mockApi({ recurring: RECURRING })

    const w = mount(HomePage)
    await flushPromises()

    expect(w.text()).toContain('Prochaines échéances')
    expect(w.findAll('.upcoming__title').map((t) => t.text())).toEqual(['Loyer', 'Netflix', 'Salle de sport'])
  })

  it('ignore les charges en pause ou terminées', async () => {
    mockApi({ recurring: RECURRING })

    const w = mount(HomePage)
    await flushPromises()

    expect(w.text()).not.toContain('En pause')
  })

  it('renvoie vers la page des charges fixes', async () => {
    mockApi({ recurring: RECURRING })

    const w = mount(HomePage)
    await flushPromises()

    expect(w.find('section[aria-labelledby="home-upcoming"] a').attributes('href')).toBe('/recurring')
  })

  it('aucune charge fixe : pas de rubrique', async () => {
    mockApi()

    const w = mount(HomePage)
    await flushPromises()

    expect(w.text()).not.toContain('Prochaines échéances')
  })
})

