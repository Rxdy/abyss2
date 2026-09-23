/**
 * Tests utilitaire — recherche de transactions
 */

import { describe, it, expect } from 'vitest'
import { normalizeText, matchesSearch } from '@/utils/search.js'

const tx = (over = {}) => ({
  title: 'Café du coin', note: null, category: { id: 'c1', name: 'Restaurants' }, ...over,
})

describe('normalizeText', () => {
  it('passe en minuscules et retire les accents', () => {
    expect(normalizeText('  Café ÉTÉ  ')).toBe('cafe ete')
  })

  it('tolère null et undefined', () => {
    expect(normalizeText(null)).toBe('')
    expect(normalizeText(undefined)).toBe('')
  })
})

describe('matchesSearch', () => {
  it('une recherche vide garde tout', () => {
    expect(matchesSearch(tx(), '')).toBe(true)
    expect(matchesSearch(tx(), '   ')).toBe(true)
  })

  it('ignore la casse et les accents', () => {
    expect(matchesSearch(tx(), 'CAFE')).toBe(true)
    expect(matchesSearch(tx({ title: 'Cafe' }), 'café')).toBe(true)
  })

  it('cherche dans le libellé, la note et la catégorie', () => {
    expect(matchesSearch(tx(), 'coin')).toBe(true)
    expect(matchesSearch(tx({ note: 'avec Marc' }), 'marc')).toBe(true)
    expect(matchesSearch(tx(), 'restaurant')).toBe(true)
  })

  it('exige tous les mots, dans n\'importe quel ordre', () => {
    expect(matchesSearch(tx(), 'coin cafe')).toBe(true)
    expect(matchesSearch(tx(), 'cafe pizza')).toBe(false)
  })

  it('fonctionne sans note ni catégorie', () => {
    expect(matchesSearch(tx({ category: null }), 'cafe')).toBe(true)
    expect(matchesSearch(tx({ category: null }), 'restaurant')).toBe(false)
  })
})
