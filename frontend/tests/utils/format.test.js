/**
 * Tests utilitaire — format
 */

import { describe, it, expect, afterEach } from 'vitest'
import { todayISO, formatAmount, formatSignedAmount, currencySymbol, setCurrency, getCurrency, CURRENCIES } from '@/utils/format.js'

describe('todayISO', () => {
  it('donne la date locale (pas la date UTC) au format yyyy-mm-dd', () => {
    // Construit en heure locale : 23 h 30 le 15 juin, quel que soit le fuseau de la machine.
    expect(todayISO(new Date(2026, 5, 15, 23, 30))).toBe('2026-06-15')
    expect(todayISO(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01')
  })

  it('complète mois et jour sur deux chiffres', () => {
    expect(todayISO(new Date(2026, 2, 5, 12))).toBe('2026-03-05')
  })
})

describe('devise d\'affichage', () => {
  afterEach(() => setCurrency('EUR'))

  it('euro par défaut', () => {
    expect(formatAmount(123456)).toBe('1\u202f234,56\u00a0€')
    expect(currencySymbol()).toBe('€')
  })

  it('suit la devise choisie, symbole compris', () => {
    setCurrency('CHF')
    expect(formatAmount(4250)).toContain('CHF')
    expect(formatSignedAmount(4250, 'expense')).toMatch(/^-.*CHF$/)
    expect(currencySymbol()).toBe('CHF')
    expect(getCurrency()).toBe('CHF')
  })

  it('une devise inconnue retombe sur l\'euro', () => {
    setCurrency('JPY')
    expect(getCurrency()).toBe('EUR')
  })

  it('propose la même liste que l\'API', () => {
    expect(CURRENCIES.map((c) => c.code)).toEqual(['EUR', 'USD', 'GBP', 'CHF', 'CAD'])
  })
})
