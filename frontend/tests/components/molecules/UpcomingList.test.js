/**
 * Tests composant — UpcomingList
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UpcomingList from '@/components/molecules/UpcomingList.vue'

const ITEMS = [
  { id: 'r1', title: 'Loyer', amount: 72000, type: 'expense', nextDate: '2026-10-05' },
  { id: 'r2', title: 'Salaire', amount: 235000, type: 'income', nextDate: '2026-10-28' },
]
const mountList = (items = ITEMS) => mount(UpcomingList, { props: { items } })

describe('UpcomingList', () => {
  it('une ligne par échéance : date courte, libellé, montant', () => {
    const w = mountList()

    expect(w.findAll('li')).toHaveLength(2)
    expect(w.text()).toContain('Loyer')
    expect(w.text()).toMatch(/5\s+oct/)
    expect(w.text()).toContain('Salaire')
  })

  it('une dépense est en négatif et en rouge, un revenu en vert sans signe moins', () => {
    const [expense, income] = mountList().findAll('.upcoming__amount')

    expect(expense.text()).toMatch(/^[-−]\s?720,00/)
    expect(expense.classes().join(' ')).toMatch(/danger/)
    expect(income.text()).not.toMatch(/[-−]/)
    expect(income.classes().join(' ')).toMatch(/success/)
  })

  it('garde l\'ordre reçu (la page trie)', () => {
    const ids = mountList([ITEMS[1], ITEMS[0]]).findAll('.upcoming__title').map((t) => t.text())

    expect(ids).toEqual(['Salaire', 'Loyer'])
  })

  it('liste vide : rien', () => {
    expect(mountList([]).findAll('li')).toHaveLength(0)
  })
})
