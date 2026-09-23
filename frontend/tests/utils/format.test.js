/**
 * Tests utilitaire — format
 */

import { describe, it, expect } from 'vitest'
import { todayISO } from '@/utils/format.js'

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
