/**
 * Outils communs aux tests de base de données (PostgreSQL réel).
 *
 * Chaque fichier de test crée ses utilisateurs avec son propre préfixe
 * d'email_hash et les supprime en fin de fichier : la suppression en cascade
 * emporte catégories, transactions et charges fixes.
 */

import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

/** Hash factice de 64 caractères, reconnaissable par son préfixe. */
export function fakeHash(prefix: string, suffix = '') {
  return (prefix + suffix).padEnd(64, '0').slice(0, 64)
}

export async function createUser(prefix: string, suffix = '') {
  return prisma.user.create({
    data: {
      emailHash:      fakeHash(prefix, suffix),
      emailEncrypted: 'iv:tag:ciphertext',
      passwordHash:   '$2a$12$notarealhashnotarealhashnotarealhashnotarealhashno',
    },
  })
}

export function createCategory(userId: string, data: { parentId?: string; color?: string | null; name?: string } = {}) {
  return prisma.category.create({
    data: {
      userId,
      nameEncrypted: 'iv:tag:name',
      color: data.color === undefined ? '#488efe' : data.color,
      parentId: data.parentId ?? null,
    },
  })
}

export function createEnvelope(userId: string) {
  return prisma.envelope.create({
    data: {
      userId,
      nameEncrypted:   'iv:tag:name',
      budgetEncrypted: 'iv:tag:budget',
    },
  })
}

export function createNotification(userId: string, data: { type?: string; envelopeId?: string } = {}) {
  return prisma.notification.create({
    data: {
      userId,
      type: data.type ?? 'envelope_overspend',
      envelopeId: data.envelopeId ?? null,
    },
  })
}

export function createTransaction(userId: string, data: { categoryId?: string; recurringId?: string; type?: string } = {}) {
  return prisma.transaction.create({
    data: {
      userId,
      categoryId:      data.categoryId ?? null,
      recurringId:     data.recurringId ?? null,
      titleEncrypted:  'iv:tag:title',
      amountEncrypted: 'iv:tag:amount',
      date:            new Date('2026-09-01'),
      ...(data.type && { type: data.type }),
    },
  })
}

export function createRecurring(userId: string, data: { categoryId?: string } = {}) {
  return prisma.recurringTransaction.create({
    data: {
      userId,
      categoryId:      data.categoryId ?? null,
      titleEncrypted:  'iv:tag:title',
      amountEncrypted: 'iv:tag:amount',
      dayOfMonth:      5,
      startDate:       new Date('2026-01-01'),
    },
  })
}

export function createResetToken(userId: string, data: { tokenHash?: string; expiresAt?: Date } = {}) {
  return prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: data.tokenHash ?? 'a'.repeat(64),
      expiresAt: data.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000),
    },
  })
}

/** Supprime les utilisateurs de test d'un préfixe (cascade sur toutes leurs données). */
export function cleanup(prefix: string) {
  return prisma.user.deleteMany({ where: { emailHash: { startsWith: prefix } } })
}

/**
 * Exécute un SQL brut et renvoie le message d'erreur PostgreSQL (ou null).
 * Permet de vérifier le NOM de la contrainte violée, pas seulement l'échec.
 */
export async function sqlError(query: string, ...params: unknown[]): Promise<string | null> {
  try {
    await prisma.$executeRawUnsafe(query, ...params)
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

/** Colonnes d'une table : { nom: { type, nullable, length, hasDefault } }. */
export async function columnsOf(table: string) {
  const rows = await prisma.$queryRaw<{
    column_name: string; data_type: string; is_nullable: string
    character_maximum_length: number | null; column_default: string | null
  }[]>`
    SELECT column_name, data_type, is_nullable, character_maximum_length, column_default
    FROM information_schema.columns
    WHERE table_schema = 'dbo' AND table_name = ${table}
  `
  return Object.fromEntries(rows.map((r) => [r.column_name, {
    type:       r.data_type,
    nullable:   r.is_nullable === 'YES',
    length:     r.character_maximum_length,
    hasDefault: r.column_default !== null,
  }]))
}
