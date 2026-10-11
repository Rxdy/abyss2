/**
 * Tests — date la plus ancienne saisissable (mois de création du compte)
 */

import { describe, it, expect } from 'vitest'
import { minEntryDate, tooEarlyMessage } from '@/utils/entryDate.js'

describe('minEntryDate', () => {
  it('borne au 1er du mois de création du compte', () => {
    expect(minEntryDate('2026-10-01')).toBe('2026-10-01')
    expect(minEntryDate('2026-10-01', '2026-10-15')).toBe('2026-10-01')
  })

  it('garde la date déjà enregistrée quand elle est plus ancienne', () => {
    expect(minEntryDate('2026-10-01', '2026-08-20')).toBe('2026-08-20')
  })

  it('ne borne rien tant que la date du compte est inconnue', () => {
    expect(minEntryDate(undefined, '2026-08-20')).toBeUndefined()
  })
})

describe('tooEarlyMessage', () => {
  it('nomme le mois de création du compte', () => {
    expect(tooEarlyMessage('2026-10-01')).toBe('Pas de date avant le 1er octobre 2026 : votre compte démarre ce mois-là.')
  })
})
