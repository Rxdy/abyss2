/**
 * Tests unitaires — passwordStrength (port TypeScript de l'estimateur front).
 *
 * Les vecteurs ci-dessous reprennent volontairement des cas du fichier miroir
 * `frontend/tests/utils/passwordStrength.test.js` : les deux algorithmes doivent
 * rester d'accord. Une dérive entre le front (qui affiche la jauge) et l'API
 * (qui tranche) ferait accepter par le formulaire un mot de passe que l'API
 * refuserait, ou l'inverse.
 */

import { describe, it, expect } from 'vitest'
import {
  PASSWORD_MAX, PASSWORD_MIN, REQUIRED_BITS, REQUIRED_LEVEL, REQUIRED_PERCENT, STRENGTH_LEVELS,
  estimateEntropy, evaluatePassword, weakPasswordMessage,
} from '../src/utils/passwordStrength.js'

describe('échelle — identique au front', () => {
  it('cinq niveaux, le niveau requis est « Fort » à 60 bits (75 %)', () => {
    expect(STRENGTH_LEVELS.map((l) => l.label)).toEqual(['Très faible', 'Faible', 'Moyen', 'Fort', 'Très fort'])
    expect(STRENGTH_LEVELS[REQUIRED_LEVEL].label).toBe('Fort')
    expect(REQUIRED_BITS).toBe(60)
    expect(REQUIRED_PERCENT).toBe(75)
    expect(PASSWORD_MIN).toBe(8)
    expect(PASSWORD_MAX).toBe(72)
  })
})

describe('evaluatePassword — vecteurs partagés avec le front', () => {
  it.each([
    ['', null, false],
    ['aaaaaaaaaaaa', 'Très faible', false],
    ['demo1234', 'Très faible', false],
    ['Bonjour42', 'Très faible', false],
    ['password123', 'Très faible', false],
    ['abcdefgh12345678', 'Moyen', false],
    ['Zx9!Qw8@', 'Moyen', false],
    ['Zx9!Qw8@Er', 'Fort', true],
    ['Tirelire_Abyss-99', 'Très fort', true],
    ['Vélo-Bleu_Rapide-4821', 'Très fort', true],
  ])('%s → %s (acceptable : %s)', (password, label, acceptable) => {
    const result = evaluatePassword(password)
    expect(result.label).toBe(label ?? '')
    expect(result.acceptable).toBe(acceptable)
  })

  it('un mot courant plafonne le niveau, même long et varié', () => {
    expect(evaluatePassword('Password-2026!Password').acceptable).toBe(false)
  })

  it('les répétitions ne rapportent presque rien', () => {
    expect(evaluatePassword('aaaaaaaaaaaaaaaa').label).toBe('Très faible')
  })
})

describe('estimateEntropy', () => {
  it('vaut 0 pour un champ vide', () => {
    expect(estimateEntropy('').bits).toBe(0)
  })

  it('suit longueur × log2(alphabet) pour un mot de passe sans motif', () => {
    expect(estimateEntropy('kqmzvxjwph').bits).toBeCloseTo(10 * Math.log2(26), 5)
  })
})

describe('weakPasswordMessage', () => {
  it('nomme le niveau atteint, le pourcentage, et le niveau requis', () => {
    const message = weakPasswordMessage(evaluatePassword('Bonjour42'))

    expect(message).toBe('Mot de passe trop faible (« Très faible », 29 %) : le niveau « Fort » est requis.')
  })
})
