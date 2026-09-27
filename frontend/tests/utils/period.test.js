/**
 * Tests utilitaire — période de comparaison des statistiques
 */

import { describe, it, expect } from 'vitest'
import { compareTotals, monthRange, previousPeriod, shiftMonth } from '@/utils/period.js'

const month = (from, to, today) => previousPeriod({ view: 'month', from, to, today })
const year  = (from, to, today) => previousPeriod({ view: 'year', from, to, today })

describe('previousPeriod — mois', () => {
  it('un mois terminé se compare au mois précédent entier', () => {
    expect(month('2026-09-01', '2026-09-30', '2026-10-15')).toEqual({ from: '2026-08-01', to: '2026-08-31', label: 'août 2026' })
  })

  it('le mois en cours se compare au même nombre de jours du précédent', () => {
    // au 21 septembre : 21 jours écoulés (le 21 inclus) → 1er → 21 août
    expect(month('2026-09-01', '2026-09-30', '2026-09-21')).toEqual({ from: '2026-08-01', to: '2026-08-21', label: 'août, au 21' })
  })

  it('le premier jour du mois, on compare le 1er au 1er', () => {
    expect(month('2026-09-01', '2026-09-30', '2026-09-01')).toMatchObject({ from: '2026-08-01', to: '2026-08-01' })
  })

  it('ne dépasse pas la fin du mois précédent (31 mars → février)', () => {
    expect(month('2026-03-01', '2026-03-31', '2026-03-31')).toMatchObject({ from: '2026-02-01', to: '2026-02-28' })
  })

  it('février bissextile', () => {
    expect(month('2028-03-01', '2028-03-31', '2028-04-20')).toMatchObject({ from: '2028-02-01', to: '2028-02-29' })
  })

  it('passe le 1er janvier sur décembre de l\'année précédente', () => {
    expect(month('2026-01-01', '2026-01-31', '2026-02-10')).toEqual({ from: '2025-12-01', to: '2025-12-31', label: 'décembre 2025' })
  })

  it('un mois futur (aucun jour écoulé) reste un mois entier', () => {
    expect(month('2026-11-01', '2026-11-30', '2026-09-21')).toMatchObject({ from: '2026-10-01', to: '2026-10-31' })
  })
})

describe('previousPeriod — année', () => {
  it('une année terminée se compare à l\'année précédente entière', () => {
    expect(year('2025-01-01', '2025-12-31', '2026-09-21')).toEqual({ from: '2024-01-01', to: '2024-12-31', label: '2024' })
  })

  it('l\'année en cours se compare à la même date de l\'année précédente', () => {
    expect(year('2026-01-01', '2026-12-31', '2026-09-21')).toEqual({ from: '2025-01-01', to: '2025-09-21', label: '2025, à la même date' })
  })

  it('le 29 février retombe sur le 28', () => {
    expect(year('2028-01-01', '2028-12-31', '2028-02-29')).toMatchObject({ to: '2027-02-28' })
  })
})

describe('previousPeriod — personnalisé', () => {
  it('prend la période de même durée juste avant', () => {
    expect(previousPeriod({ view: 'custom', from: '2026-09-10', to: '2026-09-20', today: '2026-09-21' }))
      .toEqual({ from: '2026-08-30', to: '2026-09-09', label: 'la période précédente' })
  })

  it('un seul jour se compare à la veille', () => {
    expect(previousPeriod({ view: 'custom', from: '2026-09-10', to: '2026-09-10', today: '2026-09-21' }))
      .toMatchObject({ from: '2026-09-09', to: '2026-09-09' })
  })

  it('les deux périodes ont la même durée, à cheval sur une année', () => {
    const { from, to } = previousPeriod({ view: 'custom', from: '2026-01-05', to: '2026-01-15', today: '2026-09-21' })

    expect([from, to]).toEqual(['2025-12-25', '2026-01-04'])
  })
})

describe('compareTotals', () => {
  it('calcule l\'écart, le pourcentage et le sens', () => {
    expect(compareTotals(11000, 10000)).toMatchObject({ diff: 1000, percent: 10, direction: 'up' })
    expect(compareTotals(7500, 10000)).toMatchObject({ diff: -2500, percent: -25, direction: 'down' })
  })

  it('arrondit le pourcentage à une décimale', () => {
    expect(compareTotals(10333, 10000).percent).toBe(3.3)
  })

  it('valeurs identiques : à plat', () => {
    expect(compareTotals(5000, 5000)).toMatchObject({ diff: 0, percent: 0, direction: 'flat', tone: 'neutral' })
  })

  it('pas de pourcentage sans base de comparaison', () => {
    expect(compareTotals(5000, 0)).toMatchObject({ percent: null, direction: 'up' })
    expect(compareTotals(0, 0)).toMatchObject({ percent: null, direction: 'flat' })
  })

  it('pour une dépense, la hausse est défavorable et la baisse favorable', () => {
    expect(compareTotals(12000, 10000, 'expense').tone).toBe('bad')
    expect(compareTotals(8000, 10000, 'expense').tone).toBe('good')
  })

  it('pour un revenu, c\'est l\'inverse', () => {
    expect(compareTotals(12000, 10000, 'income').tone).toBe('good')
    expect(compareTotals(8000, 10000, 'income').tone).toBe('bad')
  })
})

describe('shiftMonth', () => {
  it.each([
    ['2026-09', 1, '2026-10'],
    ['2026-09', -1, '2026-08'],
    ['2026-12', 1, '2027-01'],
    ['2026-01', -1, '2025-12'],
    ['2026-03', 0, '2026-03'],
    ['2026-09', -12, '2025-09'],
    ['2026-09', 15, '2027-12'],
  ])('%s %+i mois → %s', (month, delta, expected) => {
    expect(shiftMonth(month, delta)).toBe(expected)
  })
})

describe('monthRange', () => {
  it.each([
    ['2026-09', '2026-09-01', '2026-09-30'],
    ['2026-12', '2026-12-01', '2026-12-31'],
    ['2026-02', '2026-02-01', '2026-02-28'],
    ['2028-02', '2028-02-01', '2028-02-29'],
  ])('%s', (month, from, to) => {
    expect(monthRange(month)).toEqual({ from, to })
  })
})

