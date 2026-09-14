/**
 * Tests unitaires — utils/crypto
 * Blind index (HMAC-SHA256) + chiffrement AES-256-GCM.
 */

import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.MASTER_SECRET = 'b'.repeat(64)
})

const { hashEmail, encryptEmail, decryptEmail, encryptValue, decryptValue } =
  await import('../src/utils/crypto.js')

describe('hashEmail — blind index', () => {
  it('est déterministe pour un même email', () => {
    expect(hashEmail('alice@example.com')).toBe(hashEmail('alice@example.com'))
  })

  it('normalise la casse et les espaces', () => {
    expect(hashEmail('  Alice@Example.COM ')).toBe(hashEmail('alice@example.com'))
  })

  it('produit 64 caractères hexadécimaux', () => {
    expect(hashEmail('alice@example.com')).toMatch(/^[0-9a-f]{64}$/)
  })

  it('donne des empreintes différentes pour des emails différents', () => {
    expect(hashEmail('alice@example.com')).not.toBe(hashEmail('bob@example.com'))
  })

  it('ne contient jamais l\'email en clair', () => {
    expect(hashEmail('alice@example.com')).not.toContain('alice')
  })
})

describe('encryptEmail / decryptEmail', () => {
  it('fait un aller-retour fidèle', () => {
    expect(decryptEmail(encryptEmail('alice@example.com'))).toBe('alice@example.com')
  })

  it('respecte le format iv:authTag:ciphertext', () => {
    const parts = encryptEmail('alice@example.com').split(':')
    expect(parts).toHaveLength(3)
    expect(parts[0]).toMatch(/^[0-9a-f]{24}$/) // IV 12 bytes
    expect(parts[1]).toMatch(/^[0-9a-f]{32}$/) // authTag 16 bytes
  })

  it('produit un chiffré différent à chaque appel (IV aléatoire)', () => {
    expect(encryptEmail('alice@example.com')).not.toBe(encryptEmail('alice@example.com'))
  })

  it('ne laisse pas fuiter l\'email en clair', () => {
    expect(encryptEmail('alice@example.com')).not.toContain('alice')
  })

  it('rejette un contenu altéré (authTag invalide)', () => {
    const [iv, tag, cipher] = encryptEmail('alice@example.com').split(':')
    const tampered = `${iv}:${tag}:${cipher.slice(0, -2)}ff`
    expect(() => decryptEmail(tampered)).toThrow()
  })

  it('rejette un format invalide', () => {
    expect(() => decryptEmail('pas-un-chiffre')).toThrow('Invalid encrypted value format')
  })
})

describe('encryptValue / decryptValue — séparation des usages', () => {
  it('fait un aller-retour avec le même usage', () => {
    expect(decryptValue(encryptValue('EUR', 'user-settings'), 'user-settings')).toBe('EUR')
  })

  it('échoue si l\'usage (donc la clé dérivée) diffère', () => {
    const encrypted = encryptValue('EUR', 'user-settings')
    expect(() => decryptValue(encrypted, 'email-encryption')).toThrow()
  })
})
