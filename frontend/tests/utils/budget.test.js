/**
 * Tests utilitaire — budgets par catégorie
 */

import { describe, it, expect } from 'vitest'
import { WARN_AT, budgetStatus, buildBudgets, spentByCategory } from '@/utils/budget.js'

describe('budgetStatus', () => {
  it('large : « ok », avec ce qui reste', () => {
    expect(budgetStatus(10000, 40000)).toEqual({ percent: 25, status: 'ok', remaining: 30000 })
  })

  it('à partir de 80 % on prévient', () => {
    expect(WARN_AT).toBe(0.8)
    expect(budgetStatus(31999, 40000).status).toBe('ok')
    expect(budgetStatus(32000, 40000).status).toBe('warn')
  })

  it('pile au plafond : encore « warn », rien de dépassé', () => {
    expect(budgetStatus(40000, 40000)).toEqual({ percent: 100, status: 'warn', remaining: 0 })
  })

  it('un centime de trop : dépassé', () => {
    expect(budgetStatus(40001, 40000)).toMatchObject({ status: 'over', remaining: -1 })
  })

  it('le pourcentage peut dépasser 100', () => {
    expect(budgetStatus(60000, 40000)).toEqual({ percent: 150, status: 'over', remaining: -20000 })
  })

  it('rien dépensé', () => {
    expect(budgetStatus(0, 40000)).toEqual({ percent: 0, status: 'ok', remaining: 40000 })
  })

  it('budget nul : pas de division par zéro', () => {
    expect(budgetStatus(500, 0).percent).toBe(0)
  })
})

describe('spentByCategory', () => {
  const STATS = [
    { id: 'food', amount: 30000, children: [{ id: 'resto', amount: 10000 }, { id: 'courses', amount: 15000 }] },
    { id: 'transport', amount: 20000, children: [] },
    { id: null, amount: 500, children: [] }, // « sans catégorie »
  ]

  it('associe un identifiant à son montant, parents et enfants', () => {
    const spent = spentByCategory(STATS)

    expect(spent.get('food')).toBe(30000)
    expect(spent.get('resto')).toBe(10000)
    expect(spent.get('transport')).toBe(20000)
  })

  it('ignore la ligne « sans catégorie »', () => {
    expect(spentByCategory(STATS).size).toBe(4)
  })

  it('tolère une liste absente', () => {
    expect(spentByCategory().size).toBe(0)
    expect(spentByCategory([{ id: 'a', amount: 1 }]).get('a')).toBe(1)
  })
})

describe('buildBudgets', () => {
  const CATEGORIES = [
    { id: 'food', name: 'Alimentation', color: '#4ade80', budget: 40000 },
    { id: 'fun', name: 'Loisirs', color: '#facc15', budget: 10000 },
    { id: 'transport', name: 'Transport', color: '#38bdf8', budget: null },
    { id: 'misc', name: 'Divers', color: null },
  ]
  const STATS = [
    { id: 'food', amount: 30000, children: [] },
    { id: 'fun', amount: 12000, children: [] },
    { id: 'transport', amount: 999, children: [] },
  ]

  it('ne garde que les catégories qui ont un budget', () => {
    expect(buildBudgets(CATEGORIES, STATS).map((b) => b.id).sort()).toEqual(['food', 'fun'])
  })

  it('joint le dépensé du mois et l\'état', () => {
    const food = buildBudgets(CATEGORIES, STATS).find((b) => b.id === 'food')

    expect(food).toMatchObject({ name: 'Alimentation', budget: 40000, spent: 30000, percent: 75, status: 'ok', remaining: 10000 })
  })

  it('une catégorie sans dépense ce mois-ci est à zéro', () => {
    const [only] = buildBudgets(CATEGORIES, [])

    expect(only.spent).toBe(0)
    expect(only.status).toBe('ok')
  })

  it('les plus avancées d\'abord, dépassements en tête', () => {
    expect(buildBudgets(CATEGORIES, STATS).map((b) => b.id)).toEqual(['fun', 'food'])
  })

  it('à égalité, ordre alphabétique', () => {
    const list = buildBudgets(
      [{ id: 'b', name: 'Zèbre', budget: 100 }, { id: 'a', name: 'Abeille', budget: 100 }],
      [],
    )

    expect(list.map((b) => b.name)).toEqual(['Abeille', 'Zèbre'])
  })

  it('un budget sur une sous-catégorie est suivi séparément de sa parente', () => {
    const list = buildBudgets(
      [{ id: 'resto', name: 'Restaurants', budget: 5000 }],
      [{ id: 'food', amount: 30000, children: [{ id: 'resto', amount: 4000 }] }],
    )

    expect(list[0]).toMatchObject({ spent: 4000, percent: 80, status: 'warn' })
  })
})
