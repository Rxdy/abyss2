/**
 * Tests composant — BalanceCard
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import BalanceCard from '@/components/molecules/BalanceCard.vue'

const mountCard = (props = {}, slots = {}) =>
  mount(BalanceCard, { props: { balance: 123456, monthIncome: 235000, monthExpense: 72000, ...props }, slots })

describe('BalanceCard', () => {
  it('affiche le solde, puis revenus et dépenses du mois', () => {
    const w = mountCard()

    expect(w.text()).toMatch(/1\s234,56\s€/)
    expect(w.text()).toMatch(/Revenus\s*2\s350,00\s€/)
    expect(w.text()).toMatch(/Dépenses\s*720,00\s€/)
  })

  it('un solde négatif est en rouge', () => {
    const amount = mountCard({ balance: -5000 }).find('.balance__amount')

    expect(amount.classes().join(' ')).toMatch(/danger/)
    expect(amount.text()).toMatch(/[-−]\s?50,00/)
  })

  it('un solde positif reste en couleur principale', () => {
    expect(mountCard().find('.balance__amount').classes().join(' ')).not.toMatch(/danger/)
  })

  it('accueille le sélecteur de mois de la page, au-dessus de revenus et dépenses', () => {
    const w = mountCard({}, { month: () => h('div', { class: 'picker' }, 'Septembre 2026') })

    const period = w.find('.balance__period')
    expect(period.find('.picker').exists()).toBe(true)
    expect(period.html().indexOf('picker')).toBeLessThan(period.html().indexOf('Revenus'))
  })

  it('n\'affiche plus de mention « Mois en cours » en dur', () => {
    expect(mountCard().text()).not.toContain('Mois en cours')
  })

  it('la carte est nommée par le libellé « Solde »', () => {
    const section = mountCard().find('section')

    expect(section.attributes('aria-labelledby')).toBe('balance-title')
  })
})
