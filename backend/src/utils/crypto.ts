/**
 * Utilitaires cryptographiques pour Abyss2
 *
 * BLIND INDEX pour l'email :
 *   - HMAC-SHA256(email, MASTER_SECRET) → emailHash  (64 hex, indexé, unique)
 *   - AES-256-GCM(email, clé dérivée)  → emailEncrypted (pour affichage)
 *
 * La clé AES est dérivée du MASTER_SECRET via scrypt (jamais stockée).
 * Le HMAC permet le lookup sans exposer l'email en clair en base.
 */

import * as crypto from 'node:crypto'

/**
 * Retourne le MASTER_SECRET depuis les variables d'environnement.
 * Lance une erreur si absent (fail-fast).
 */
function getMasterSecret() {
  const secret = process.env.MASTER_SECRET
  if (!secret) throw new Error('MASTER_SECRET env var is required')
  return secret
}

/**
 * Dérive une clé AES-256 (32 bytes) depuis le MASTER_SECRET.
 * Le `usage` sépare les usages (email vs futures clés) — mis en cache car
 * scrypt est volontairement coûteux.
 */
const keyCache = new Map<string, Buffer>()

function deriveKey(usage: string) {
  if (keyCache.has(usage)) {
    return keyCache.get(usage) as Buffer
  }

  const key = crypto.scryptSync(getMasterSecret(), `abyss2:${usage}`, 32)
  keyCache.set(usage, key)
  return key
}

function encryptSecret(value: string, usage: string) {
  const key = deriveKey(usage)
  const iv  = crypto.randomBytes(12)

  const cipher    = crypto.createCipheriv('aes-256-gcm', key, iv)
  let   encrypted = cipher.update(value, 'utf8', 'hex')
  encrypted      += cipher.final('hex')
  const authTag   = cipher.getAuthTag()

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

function decryptSecret(encryptedValue: string, usage: string) {
  const parts = encryptedValue.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted value format')

  const [ivHex, authTagHex, ciphertext] = parts
  const key     = deriveKey(usage)
  const iv      = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  let decrypted  = decipher.update(ciphertext, 'hex', 'utf8')
  decrypted     += decipher.final('utf8')

  return decrypted
}

// ── Blind index ──────────────────────────────────────────────

/**
 * Calcule le blind index de l'email (HMAC-SHA256).
 * Identique pour la même adresse email → permet la recherche en base.
 * Ne révèle pas l'email en clair même si la DB est compromise.
 *
 * @returns 64 hex chars
 */
export function hashEmail(email: string) {
  return crypto
    .createHmac('sha256', getMasterSecret())
    .update(email.toLowerCase().trim())
    .digest('hex')
}

// ── Chiffrement AES-256-GCM ──────────────────────────────────

/**
 * Chiffre une valeur avec AES-256-GCM.
 * Format retourné : "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 * L'IV est aléatoire (12 bytes) à chaque chiffrement.
 */
export function encryptValue(value: string, usage = 'user-settings') {
  return encryptSecret(value, usage)
}

export function decryptValue(encryptedValue: string, usage = 'user-settings') {
  return decryptSecret(encryptedValue, usage)
}

export function encryptEmail(email: string) {
  return encryptValue(email.toLowerCase().trim(), 'email-encryption')
}

/**
 * Déchiffre un email chiffré par encryptEmail().
 * Lance une erreur si le contenu est altéré (authTag invalide).
 */
export function decryptEmail(encryptedEmail: string) {
  return decryptValue(encryptedEmail, 'email-encryption')
}

// ── Jetons à usage unique (réinitialisation de mot de passe) ──

/**
 * Hash SHA-256 d'un jeton de haute entropie (32 octets aléatoires, voir routes/auth.ts).
 * Contrairement à `hashEmail`, pas besoin de HMAC ici : le jeton n'est pas devinable par
 * dictionnaire (contrairement à un email), un simple hash suffit à empêcher qu'une fuite de la
 * base (qui ne contient que ce hash) permette de rejouer le lien envoyé par email.
 */
export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}
