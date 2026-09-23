/**
 * Tests composant — CategoryBreakdown
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CategoryBreakdown from '@/components/molecules/CategoryBreakdown.vue'

const CATEGORIES = [
  {
    id: 'food', name: 'Alimentation', color: '#4ade80', amount: 30000, percentage: 75,
    children: [
      { id: 'resto', name: 'Restaurants', color: '#86efac', amount: 10000, percentage: 33.3 },
    ],
  },
  { id: null, name: 'Sans catégorie', color: null, amount: 10000, percentage: 25, children: [] },
]

describe('CategoryBreakdown', () => {
  it('affiche nom, montant et part de chaque catégorie', () => {
    const w = mount(CategoryBreakdown, { props: { categories: CATEGORIES } })

    expect(w.text()).toContain('Alimentation')
    expect(w.text()).toContain('300,00')
    expect(w.text()).toContain('75%')
    expect(w.text()).toContain('Sans catégorie')
  })

  it('affiche les sous-catégories en retrait', () => {
    const w = mount(CategoryBreakdown, { props: { categories: CATEGORIES } })

    expect(w.findAll('.category-stat__children .child-stat')).toHaveLength(1)
    expect(w.find('.child-stat').text()).toContain('Restaurants')
    expect(w.find('.child-stat').text()).toContain('33.3%')
  })

  it('les barres portent un libellé accessible et une largeur proportionnelle', () => {
    const w = mount(CategoryBreakdown, { props: { categories: CATEGORIES } })
    const bars = w.findAll('[role="img"]')

    expect(bars[0].attributes('aria-label')).toBe('Alimentation : 75% du total')
    expect(bars[0].find('.bar-fill').attributes('style')).toContain('width: 75%')
    expect(bars[1].attributes('aria-label')).toBe('Restaurants : 33.3% de Alimentation')
  })

  it('une catégorie sans couleur utilise la teinte neutre', () => {
    const w = mount(CategoryBreakdown, { props: { categories: [CATEGORIES[1]] } })

    expect(w.find('.bar-fill').attributes('style')).toContain('var(--color-text-muted)')
  })

  it('liste vide : aucune ligne', () => {
    expect(mount(CategoryBreakdown, { props: { categories: [] } }).findAll('.category-stat')).toHaveLength(0)
  })
})
