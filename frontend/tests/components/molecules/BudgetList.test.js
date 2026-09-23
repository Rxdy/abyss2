/**
 * Tests composant — BudgetList
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BudgetList from '@/components/molecules/BudgetList.vue'

const B = (over = {}) => ({
  id: 'food', name: 'Alimentation', color: '#4ade80', budget: 40000, spent: 10000, percent: 25, status: 'ok', remaining: 30000, ...over,
})
const mountList = (budgets) => mount(BudgetList, { props: { budgets } })

describe('BudgetList', () => {
  it('une ligne par budget : nom, dépensé / plafond, et ce qui reste', () => {
    const w = mountList([B(), B({ id: 'fun', name: 'Loisirs', budget: 10000, spent: 2000, remaining: 8000, percent: 20 })])

    expect(w.findAll('li')).toHaveLength(2)
    expect(w.text()).toContain('Alimentation')
    expect(w.text()).toMatch(/100,00\s€\s\/\s400,00\s€/)
    expect(w.text()).toMatch(/Reste 300,00\s€/)
  })

  it('la jauge est un « meter » nommé, à la largeur du pourcentage', () => {
    const bar = mountList([B({ percent: 25 })]).find('[role="meter"]')

    expect(bar.attributes('aria-label')).toBe('Budget Alimentation')
    expect(bar.attributes('aria-valuenow')).toBe('25')
    expect(bar.find('.budget__fill').attributes('style')).toContain('width: 25%')
  })

  it('la couleur suit l\'état : ok, warn, over', () => {
    const fill = (status) => mountList([B({ status })]).find('.budget__fill').classes()

    expect(fill('ok')).toContain('budget__fill--ok')
    expect(fill('warn')).toContain('budget__fill--warn')
    expect(fill('over')).toContain('budget__fill--over')
  })

  it('un dépassement : jauge pleine (plafonnée à 100 %), et le dépassement annoncé en clair', () => {
    const w = mountList([B({ spent: 46000, percent: 115, status: 'over', remaining: -6000 })])

    expect(w.find('.budget__fill').attributes('style')).toContain('width: 100%')
    expect(w.find('[role="meter"]').attributes('aria-valuenow')).toBe('100')
    expect(w.text()).toMatch(/Dépassé de 60,00\s€/)
    expect(w.text()).not.toContain('Reste')
  })

  it('le texte lu par les lecteurs d\'écran donne le détail', () => {
    const ok = mountList([B()]).find('[role="meter"]').attributes('aria-valuetext')
    const over = mountList([B({ spent: 46000, percent: 115, status: 'over', remaining: -6000 })]).find('[role="meter"]').attributes('aria-valuetext')

    expect(ok).toMatch(/100,00\s€ sur 400,00\s€, il reste 300,00\s€/)
    expect(over).toMatch(/460,00\s€ sur 400,00\s€, dépassé de 60,00\s€/)
  })

  it('la pastille prend la couleur de la catégorie, ou la teinte neutre', () => {
    expect(mountList([B()]).find('.budget__color').attributes('style')).toContain('#4ade80')
    expect(mountList([B({ color: null })]).find('.budget__color').attributes('style')).toContain('var(--color-text-muted)')
  })

  it('liste vide : rien', () => {
    expect(mountList([]).findAll('li')).toHaveLength(0)
  })
})
