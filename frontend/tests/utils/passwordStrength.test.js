/**
 * Tests utilitaire — passwordStrength (estimation par l'entropie)
 */

import { describe, it, expect } from 'vitest'
import {
  PASSWORD_MAX, PASSWORD_MIN, REQUIRED_BITS, REQUIRED_LEVEL, REQUIRED_PERCENT, STRENGTH_LEVELS, TARGET_BITS,
  estimateEntropy, evaluatePassword,
} from '@/utils/passwordStrength.js'

describe('échelle', () => {
  it('a cinq niveaux dont les seuils croissent', () => {
    expect(STRENGTH_LEVELS.map((l) => l.label)).toEqual(['Très faible', 'Faible', 'Moyen', 'Fort', 'Très fort'])
    const bits = STRENGTH_LEVELS.map((l) => l.minBits)
    expect(bits).toEqual([...bits].sort((a, b) => a - b))
    expect(new Set(bits).size).toBe(bits.length)
    expect(bits[0]).toBe(0)
  })

  it('100 % correspond au début du dernier niveau', () => {
    expect(TARGET_BITS).toBe(STRENGTH_LEVELS.at(-1).minBits)
  })

  it('le niveau requis est « Fort » (60 bits, soit 75 % de la jauge)', () => {
    expect(STRENGTH_LEVELS[REQUIRED_LEVEL].label).toBe('Fort')
    expect(REQUIRED_BITS).toBe(60)
    expect(REQUIRED_PERCENT).toBe(75)
  })

  it('expose les mêmes bornes de longueur que l\'API', () => {
    expect(PASSWORD_MIN).toBe(8)
    expect(PASSWORD_MAX).toBe(72)
  })
})

describe('estimateEntropy', () => {
  it('vaut 0 pour un champ vide', () => {
    expect(estimateEntropy('').bits).toBe(0)
  })

  it('suit longueur × log2(alphabet) pour un mot de passe sans motif', () => {
    // 10 minuscules sans répétition ni suite : alphabet 26
    expect(estimateEntropy('kqmzvxjwph').bits).toBeCloseTo(10 * Math.log2(26), 5)
  })

  it('un alphabet plus large rapporte plus par caractère', () => {
    expect(estimateEntropy('kQ7!mZ2@vX').bits).toBeGreaterThan(estimateEntropy('kqmzvxjwph').bits)
    expect(estimateEntropy('kQ7!mZ2@vX').alphabet).toBe(26 + 26 + 10 + 33)
  })

  it('compte les accents comme un alphabet à part', () => {
    expect(estimateEntropy('éàçùêô').alphabet).toBe(30)
    expect(estimateEntropy('abcé').alphabet).toBe(26 + 30)
  })

  it('les symboles ASCII comprennent l\'espace', () => {
    expect(estimateEntropy('a b').alphabet).toBe(26 + 33)
  })

  it('ne compte pas les répétitions', () => {
    expect(estimateEntropy('aaaaaaaa').useful).toBe(1)
    expect(estimateEntropy('aabbccdd').useful).toBe(4)
  })

  it('ne compte pas les suites croissantes ni décroissantes', () => {
    expect(estimateEntropy('abcdefgh').useful).toBe(2)
    expect(estimateEntropy('98765432').useful).toBe(2)
  })

  it('retire les mots courants du calcul et leur accorde un forfait', () => {
    const result = estimateEntropy('azertykqmzvx')

    expect(result.commonWords).toBe(1)
    expect(result.useful).toBe(6)
    expect(result.bits).toBeCloseTo(6 * Math.log2(26) + 12, 5)
  })

  it('reconnaît les mots courants quelle que soit la casse, et ne les compte qu\'une fois', () => {
    expect(estimateEntropy('PassWord-password').commonWords).toBe(1)
  })

  it('préfère le mot courant le plus long (azertyuiop avant azerty)', () => {
    expect(estimateEntropy('azertyuiop').useful).toBe(0)
  })
})

describe('evaluatePassword — champ vide', () => {
  it('reste muet', () => {
    expect(evaluatePassword('')).toEqual({ bits: 0, percent: 0, level: null, label: '', acceptable: false, hint: '' })
  })
})

describe('evaluatePassword — niveaux', () => {
  const cases = [
    ['aaaaaaaaaaaa', 'Très faible'],
    ['demo1234', 'Très faible'],
    ['Bonjour42', 'Très faible'],
    ['abcdefgh12345678', 'Moyen'],
    ['Zx9!Qw8@', 'Moyen'],
    ['Zx9!Qw8@Er', 'Fort'],
    ['Vélo-Bleu_Rapide-4821', 'Très fort'],
  ]

  it.each(cases)('%s → %s', (password, label) => {
    expect(evaluatePassword(password).label).toBe(label)
  })

  it('le niveau change exactement aux seuils', () => {
    // 26 lettres : chaque caractère utile vaut log2(26) ≈ 4,7 bits → 13 → 61,1 bits, 12 → 56,4 bits
    const twelve = evaluatePassword('kqmzvxjwphdb')
    const thirteen = evaluatePassword('kqmzvxjwphdbn')

    expect(twelve.label).toBe('Moyen')
    expect(thirteen.label).toBe('Fort')
  })

  it('le pourcentage est la part de TARGET_BITS, plafonnée à 100', () => {
    const result = evaluatePassword('kqmzvxjwphdb')

    expect(result.percent).toBe(Math.floor((result.bits / TARGET_BITS) * 100))
    expect(evaluatePassword('Vélo-Bleu_Rapide-4821').percent).toBe(100)
  })

  it('un mot de passe plus long ne peut pas être moins bien noté', () => {
    let previous = -1
    for (let n = 1; n <= 20; n++) {
      const bits = evaluatePassword('kQ7!mZ2@vX4#jW9$hB6%'.slice(0, n)).bits
      expect(bits).toBeGreaterThanOrEqual(previous)
      previous = bits
    }
  })
})

describe('evaluatePassword — acceptation', () => {
  it('accepte à partir du niveau requis', () => {
    expect(evaluatePassword('Zx9!Qw8@Er').acceptable).toBe(true)
    expect(evaluatePassword('Zx9!Qw8@').acceptable).toBe(false)
  })

  it('refuse un mot de passe trop court, quelle que soit son entropie', () => {
    expect(evaluatePassword('Zx9!Qw').acceptable).toBe(false)
  })

  it('refuse un mot de passe trop long, même très fort', () => {
    expect(evaluatePassword('Zx9!Qw8@Er'.repeat(8)).acceptable).toBe(false)
  })

  it('refuse un mot courant, même long et varié', () => {
    expect(evaluatePassword('Password-2026!Password').acceptable).toBe(false)
  })
})

describe('evaluatePassword — conseils', () => {
  it('signale la longueur minimale', () => {
    expect(evaluatePassword('abc').hint).toContain(String(PASSWORD_MIN))
  })

  it('signale la longueur maximale', () => {
    expect(evaluatePassword('Zx9!Qw8@Er'.repeat(8)).hint).toContain(String(PASSWORD_MAX))
  })

  it('déconseille les mots courants', () => {
    expect(evaluatePassword('motdepasse2026').hint).toMatch(/mots courants/)
  })

  it('déconseille les répétitions et suites', () => {
    expect(evaluatePassword('aaaaaaaaaaaaaaaa').hint).toMatch(/répétitions/)
  })

  it('chiffre le nombre de caractères manquants', () => {
    // 'Zx9!Qw8@' : 52,6 bits sur un alphabet de 95 → 2 caractères de plus atteignent 60 bits
    expect(evaluatePassword('Zx9!Qw8@').hint).toMatch(/environ 2 caractères/)
  })

  it('suggère aussi de mélanger les familles quand l\'alphabet est étroit', () => {
    expect(evaluatePassword('kqmzvxjwphd').hint).toMatch(/mélangez/i)
    expect(evaluatePassword('Zx9!Qw8@').hint).not.toMatch(/mélangez/i)
  })

  it('ne dit rien quand le niveau requis est atteint', () => {
    expect(evaluatePassword('Zx9!Qw8@Er').hint).toBe('')
  })
})
