/**
 * Tests unitaires — « aujourd'hui » et « mois courant » dans le fuseau de l'application
 */

import { describe, it, expect } from 'vitest'
import { todayISO, currentMonthKey, earliestTransactionDate } from '../src/utils/date.js'

describe('todayISO', () => {
  it('en journée, la date UTC et la date de Paris coïncident', () => {
    expect(todayISO(new Date('2026-06-15T10:00:00Z'), 'Europe/Paris')).toBe('2026-06-15')
  })

  it('l\'été (UTC+2), 22 h 30 UTC est déjà le lendemain à Paris', () => {
    expect(todayISO(new Date('2026-06-15T22:30:00Z'), 'Europe/Paris')).toBe('2026-06-16')
  })

  it('l\'hiver (UTC+1), 23 h 30 UTC est déjà le lendemain à Paris', () => {
    expect(todayISO(new Date('2026-01-15T23:30:00Z'), 'Europe/Paris')).toBe('2026-01-16')
  })

  it('un autre fuseau donne sa propre date', () => {
    expect(todayISO(new Date('2026-06-15T02:00:00Z'), 'America/New_York')).toBe('2026-06-14')
  })
})

describe('currentMonthKey', () => {
  it('bascule au nouveau mois dès minuit à Paris, pas à minuit UTC', () => {
    expect(currentMonthKey(new Date('2026-06-30T22:30:00Z'), 'Europe/Paris')).toBe('2026-07')
    expect(currentMonthKey(new Date('2026-06-30T22:30:00Z'), 'UTC')).toBe('2026-06')
  })

  it('bascule d\'année à la Saint-Sylvestre', () => {
    expect(currentMonthKey(new Date('2026-12-31T23:30:00Z'), 'Europe/Paris')).toBe('2027-01')
  })
})

describe('earliestTransactionDate', () => {
  it('renvoie le 1er du mois de création du compte', () => {
    expect(earliestTransactionDate(new Date('2026-10-11T08:00:00.000Z'), 'Europe/Paris')).toBe('2026-10-01')
  })

  it('suit le fuseau de l\'application : 30 sept. 23 h 30 UTC, c\'est déjà octobre à Paris', () => {
    expect(earliestTransactionDate(new Date('2026-09-30T23:30:00.000Z'), 'Europe/Paris')).toBe('2026-10-01')
  })
})
