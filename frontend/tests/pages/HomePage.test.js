/**
 * Tests page — HomePage (tableau de bord budget : solde, revenus/dépenses
 * du mois, ajout rapide, dernières transactions)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import HomePage from '@/pages/HomePage.vue'
import { formatAmount } from '@/utils/format.js'

const SUMMARY = {
  balance: 12345,
  income: 60000,
  expense: 47655,
  monthIncome: 50000,
  monthExpense: 20000,
  month: '2026-09',
  count: 2,
  recent: [
    { id: '1', title: 'Salaire', amount: 50000, date: '2026-09-01', type: 'income', note: null, category: null },
    { id: '2', title: 'Courses', amount: 4500, date: '2026-09-03', type: 'expense', note: null, category: { id: 'c1', name: 'Alimentation', color: '#4ade80' } },
  ],
}

/** Répond selon l'URL appelée : résumé du budget, ou liste des catégories. */
function mockApi({ summary = SUMMARY, categories = [] } = {}) {
  vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
    const body = url.includes('/api/categories') ? categories : summary
    return Promise.resolve({ ok: true, status: 200, json: async () => body })
  }))
}

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

  it('affiche un message quand il n\'y a aucune transaction récente', async () => {
    mockApi({ summary: { ...SUMMARY, recent: [] } })

    const w = mount(HomePage)
    await flushPromises()

    expect(w.text()).toContain('Aucune transaction — commencez par en ajouter une.')
  })

  it('ouvre le formulaire d\'ajout au clic sur le bouton', async () => {
    mockApi()

    const w = mount(HomePage)
    await flushPromises()

    expect(w.find('#transaction-title').exists()).toBe(false)

    await w.find('button').trigger('click')

    expect(w.find('#transaction-title').exists()).toBe(true)
  })
})
