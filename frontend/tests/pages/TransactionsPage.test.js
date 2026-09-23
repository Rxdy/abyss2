/**
 * Tests page — TransactionsPage (pagination)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import TransactionsPage from '@/pages/TransactionsPage.vue'
import { PAGE_SIZE } from '@/stores/transactions.store.js'
import { router } from '../setup.js'

const tx = (n) => ({ id: `t${n}`, title: `Opération ${n}`, amount: 1000, date: '2026-09-01', type: 'expense', note: null, recurringId: null, category: null })
const page = (from, count) => Array.from({ length: count }, (_, i) => tx(from + i))

function mockApi({ total }) {
  const fetchMock = vi.fn(async (url) => {
    const { pathname, searchParams } = new URL(url)
    const body = pathname === '/api/categories'
      ? []
      : {
          items: page(Number(searchParams.get('offset') ?? 0) + 1, Math.min(PAGE_SIZE, total - Number(searchParams.get('offset') ?? 0))),
          total,
        }
    return { ok: true, status: 200, json: async () => body }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const loadMoreButton = (w) => w.findAll('button').find((b) => b.text().includes('Charger plus'))

beforeEach(() => {
  vi.unstubAllGlobals()
})

describe('TransactionsPage — pagination', () => {
  it('annonce le total et propose de charger la suite', async () => {
    mockApi({ total: 120 })
    const w = mount(TransactionsPage)
    await flushPromises()

    expect(w.text()).toContain('120 opérations')
    expect(loadMoreButton(w).text()).toContain('70 restantes')
  })

  it('charge la page suivante au clic, puis masque le bouton', async () => {
    mockApi({ total: 60 })
    const w = mount(TransactionsPage)
    await flushPromises()
    expect(w.text()).toContain('Opération 50')
    expect(w.text()).not.toContain('Opération 51')

    await loadMoreButton(w).trigger('click')
    await flushPromises()

    expect(w.text()).toContain('Opération 60')
    expect(loadMoreButton(w)).toBeUndefined()
  })

  it('n\'affiche pas le bouton quand tout tient sur une page', async () => {
    mockApi({ total: 12 })
    const w = mount(TransactionsPage)
    await flushPromises()

    expect(loadMoreButton(w)).toBeUndefined()
  })
})

describe('TransactionsPage — recherche', () => {
  const searchField = (w) => w.find('input[type="search"]')

  it('propose un champ de recherche accessible', async () => {
    mockApi({ total: 12 })
    const w = mount(TransactionsPage)
    await flushPromises()

    expect(searchField(w).exists()).toBe(true)
    expect(w.find(`label[for="${searchField(w).attributes('id')}"]`).exists()).toBe(true)
  })

  it('ne garde que les lignes qui correspondent et annonce le nombre de résultats', async () => {
    mockApi({ total: 12 })
    const w = mount(TransactionsPage)
    await flushPromises()

    await searchField(w).setValue('opération 7')
    await flushPromises()

    expect(w.text()).toContain('1 résultat')
    expect(w.text()).toContain('Opération 7')
    expect(w.text()).not.toContain('Opération 8')
  })

  it('cherche aussi dans les pages pas encore chargées, sans bouton « Charger plus »', async () => {
    mockApi({ total: 60 })
    const w = mount(TransactionsPage)
    await flushPromises()
    expect(w.text()).not.toContain('Opération 57')

    await searchField(w).setValue('opération 57')
    await flushPromises()

    expect(w.text()).toContain('Opération 57')
    expect(loadMoreButton(w)).toBeUndefined()
  })

  it('message vide dédié quand rien ne correspond, et retour à la liste en vidant le champ', async () => {
    mockApi({ total: 12 })
    const w = mount(TransactionsPage)
    await flushPromises()

    await searchField(w).setValue('introuvable')
    await flushPromises()
    expect(w.text()).toContain('Aucune transaction ne correspond')

    await searchField(w).setValue('')
    await flushPromises()
    expect(w.text()).toContain('12 opérations')
    expect(w.text()).toContain('Opération 12')
  })
})

describe('TransactionsPage — raccourci « Ajouter une transaction »', () => {
  it('ouvre le formulaire d\'ajout quand l\'URL porte ?new=1, puis nettoie l\'URL', async () => {
    mockApi({ total: 12 })
    await router.push('/transactions?new=1')
    const w = mount(TransactionsPage)
    await flushPromises()

    expect(w.findComponent({ name: 'TransactionForm' }).exists()).toBe(true)
    expect(router.currentRoute.value.query).toEqual({})
  })

  it('n\'ouvre rien sans ?new=1', async () => {
    mockApi({ total: 12 })
    await router.push('/transactions')
    const w = mount(TransactionsPage)
    await flushPromises()

    expect(w.findComponent({ name: 'TransactionForm' }).exists()).toBe(false)
  })
})

