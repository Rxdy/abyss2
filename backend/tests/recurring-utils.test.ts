/**
 * Tests unitaires — backend/src/utils/recurring.ts (fonctions pures de
 * calcul des échéances, indépendantes de Prisma)
 */

import { describe, it, expect } from 'vitest'
import {
  monthKey, addMonthKey, compareMonthKey, occurrenceDate, dueMonths, nextOccurrenceDate,
} from '../src/utils/recurring.js'

describe('monthKey', () => {
  it('formate une date UTC en YYYY-MM', () => {
    expect(monthKey(new Date('2026-09-14T00:00:00Z'))).toBe('2026-09')
    expect(monthKey(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01')
  })
})

describe('addMonthKey', () => {
  it('avance dans la même année', () => {
    expect(addMonthKey('2026-01', 2)).toBe('2026-03')
  })

  it('franchit le passage d\'année en avançant', () => {
    expect(addMonthKey('2026-12', 1)).toBe('2027-01')
  })

  it('franchit le passage d\'année en reculant', () => {
    expect(addMonthKey('2026-01', -1)).toBe('2025-12')
  })
})

describe('compareMonthKey', () => {
  it('ordonne correctement', () => {
    expect(compareMonthKey('2026-01', '2026-02')).toBeLessThan(0)
    expect(compareMonthKey('2026-02', '2026-01')).toBeGreaterThan(0)
    expect(compareMonthKey('2026-01', '2026-01')).toBe(0)
  })
})

describe('occurrenceDate', () => {
  it('place le jour demandé dans le mois', () => {
    expect(occurrenceDate('2026-09', 15).toISOString().slice(0, 10)).toBe('2026-09-15')
  })

  it('ramène au dernier jour du mois si celui-ci est plus court (avril, 30 jours)', () => {
    expect(occurrenceDate('2026-04', 31).toISOString().slice(0, 10)).toBe('2026-04-30')
  })

  it('gère février non bissextile (28 jours)', () => {
    expect(occurrenceDate('2026-02', 31).toISOString().slice(0, 10)).toBe('2026-02-28')
  })
})

describe('dueMonths', () => {
  it('rien à générer si l\'échéance de ce mois n\'est pas encore passée', () => {
    const recurring = { dayOfMonth: 28, startDate: '2026-01-01', lastGeneratedMonth: '2026-08' }
    const now = new Date('2026-09-14T00:00:00Z')

    expect(dueMonths(recurring, now)).toEqual([])
  })

  it('génère le mois courant si l\'échéance est déjà passée', () => {
    const recurring = { dayOfMonth: 1, startDate: '2026-01-01', lastGeneratedMonth: '2026-08' }
    const now = new Date('2026-09-14T00:00:00Z')

    expect(dueMonths(recurring, now)).toEqual(['2026-09'])
  })

  it('rattrape tout depuis startDate quand rien n\'a jamais été généré', () => {
    const recurring = { dayOfMonth: 1, startDate: '2026-07-01', lastGeneratedMonth: null }
    const now = new Date('2026-09-14T00:00:00Z')

    expect(dueMonths(recurring, now)).toEqual(['2026-07', '2026-08', '2026-09'])
  })

  it('rattrape plusieurs mois manqués depuis lastGeneratedMonth', () => {
    const recurring = { dayOfMonth: 1, startDate: '2026-01-01', lastGeneratedMonth: '2026-06' }
    const now = new Date('2026-09-14T00:00:00Z')

    expect(dueMonths(recurring, now)).toEqual(['2026-07', '2026-08', '2026-09'])
  })

  it('ne génère rien avant startDate, même si le jour du mois est déjà passé', () => {
    const recurring = { dayOfMonth: 1, startDate: '2026-09-15', lastGeneratedMonth: null }
    const now = new Date('2026-09-20T00:00:00Z')

    // Le 1er septembre est avant le 15 (début) : on saute directement à octobre.
    expect(dueMonths(recurring, now)).toEqual([])
  })

  it('ne génère rien si startDate est dans le futur', () => {
    const recurring = { dayOfMonth: 1, startDate: '2026-12-01', lastGeneratedMonth: null }
    const now = new Date('2026-09-14T00:00:00Z')

    expect(dueMonths(recurring, now)).toEqual([])
  })

  it('s\'arrête à endDate', () => {
    const recurring = { dayOfMonth: 1, startDate: '2026-01-01', endDate: '2026-07-15', lastGeneratedMonth: '2026-05' }
    const now = new Date('2026-09-14T00:00:00Z')

    expect(dueMonths(recurring, now)).toEqual(['2026-06', '2026-07'])
  })
})

describe('nextOccurrenceDate', () => {
  it('retombe sur ce mois-ci si l\'échéance n\'est pas encore passée', () => {
    const recurring = { dayOfMonth: 28, startDate: '2026-01-01' }
    const now = new Date('2026-09-14T00:00:00Z')

    expect(nextOccurrenceDate(recurring, now)?.toISOString().slice(0, 10)).toBe('2026-09-28')
  })

  it('passe au mois suivant si l\'échéance de ce mois est déjà passée', () => {
    const recurring = { dayOfMonth: 1, startDate: '2026-01-01' }
    const now = new Date('2026-09-14T00:00:00Z')

    expect(nextOccurrenceDate(recurring, now)?.toISOString().slice(0, 10)).toBe('2026-10-01')
  })

  it('respecte une startDate future', () => {
    const recurring = { dayOfMonth: 1, startDate: '2026-12-15' }
    const now = new Date('2026-09-14T00:00:00Z')

    expect(nextOccurrenceDate(recurring, now)?.toISOString().slice(0, 10)).toBe('2027-01-01')
  })

  it('retourne null une fois endDate dépassée', () => {
    const recurring = { dayOfMonth: 1, startDate: '2026-01-01', endDate: '2026-08-15' }
    const now = new Date('2026-09-14T00:00:00Z')

    expect(nextOccurrenceDate(recurring, now)).toBeNull()
  })
})
