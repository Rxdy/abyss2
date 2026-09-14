/**
 * Tests d'intégration — base de données réelle
 *
 * Vérifie que le schéma physique (postgres/init.sql) correspond à ce que
 * Prisma et l'API attendent. Nécessite un PostgreSQL joignable via DATABASE_URL.
 *
 *   docker compose up -d postgres
 *   npm run test:db
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Emails de test — nettoyés en fin de suite
const TEST_HASH_PREFIX = 'testdb'

function fakeHash(suffix: string) {
  return (TEST_HASH_PREFIX + suffix).padEnd(64, '0').slice(0, 64)
}

function userFixture(suffix: string) {
  return {
    emailHash:      fakeHash(suffix),
    emailEncrypted: 'iv:tag:ciphertext',
    passwordHash:   '$2a$12$notarealhashnotarealhashnotarealhashnotarealhashno',
    authSalt:       'a'.repeat(32),
    keySalt:        'b'.repeat(32),
    keyFragment:    'c'.repeat(64),
  }
}

beforeAll(async () => {
  await prisma.$connect()
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { emailHash: { startsWith: TEST_HASH_PREFIX } } })
  await prisma.$disconnect()
})

describe('connexion', () => {
  it('répond à une requête simple', async () => {
    const rows = await prisma.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok`
    expect(Number(rows[0].ok)).toBe(1)
  })

  it('expose le schéma dbo', async () => {
    const rows = await prisma.$queryRaw<{ schema_name: string }[]>`
      SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'dbo'
    `
    expect(rows).toHaveLength(1)
  })
})

describe('table dbo.users', () => {
  it('existe', async () => {
    const rows = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'dbo' AND table_name = 'users'
    `
    expect(rows).toHaveLength(1)
  })

  it('a toutes les colonnes attendues, avec le bon type et la bonne nullabilité', async () => {
    const rows = await prisma.$queryRaw<
      { column_name: string; data_type: string; is_nullable: string }[]
    >`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'dbo' AND table_name = 'users'
    `

    const columns = Object.fromEntries(rows.map((r) => [r.column_name, r]))

    expect(Object.keys(columns).sort()).toEqual([
      'auth_salt', 'created_at', 'email_encrypted', 'email_hash',
      'id', 'key_fragment', 'key_salt', 'password_hash', 'token_version', 'updated_at',
    ])

    expect(columns.id.data_type).toBe('uuid')
    expect(columns.token_version.data_type).toBe('integer')
    expect(columns.token_version.is_nullable).toBe('NO')
    expect(columns.email_hash.data_type).toBe('character varying')
    expect(columns.email_encrypted.data_type).toBe('text')
    expect(columns.password_hash.data_type).toBe('text')
    expect(columns.created_at.data_type).toBe('timestamp with time zone')

    // Aucune colonne obligatoire ne doit être nullable
    for (const name of ['email_hash', 'email_encrypted', 'password_hash', 'auth_salt', 'key_salt', 'key_fragment']) {
      expect(columns[name].is_nullable).toBe('NO')
    }
  })

  it('n\'a aucune colonne stockant un email en clair', async () => {
    const rows = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'dbo' AND table_name = 'users'
    `
    expect(rows.map((r) => r.column_name)).not.toContain('email')
  })

  it('impose l\'unicité de email_hash', async () => {
    const rows = await prisma.$queryRaw<{ constraint_type: string }[]>`
      SELECT tc.constraint_type
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name
       AND kcu.table_schema    = tc.table_schema
      WHERE tc.table_schema = 'dbo'
        AND tc.table_name   = 'users'
        AND kcu.column_name = 'email_hash'
        AND tc.constraint_type = 'UNIQUE'
    `
    expect(rows.length).toBeGreaterThanOrEqual(1)
  })

  it('indexe email_hash pour le lookup de login', async () => {
    const rows = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'dbo' AND tablename = 'users' AND indexdef LIKE '%email_hash%'
    `
    expect(rows.length).toBeGreaterThanOrEqual(1)
  })
})

describe('contraintes à l\'écriture', () => {
  it('crée et relit un utilisateur via Prisma', async () => {
    const created = await prisma.user.create({ data: userFixture('crud') })

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(created.createdAt).toBeInstanceOf(Date)

    const found = await prisma.user.findUnique({ where: { emailHash: fakeHash('crud') } })
    expect(found?.id).toBe(created.id)

    await prisma.user.delete({ where: { id: created.id } })
    expect(await prisma.user.findUnique({ where: { id: created.id } })).toBeNull()
  })

  it('refuse deux utilisateurs avec le même email_hash', async () => {
    await prisma.user.create({ data: userFixture('dup') })

    await expect(prisma.user.create({ data: userFixture('dup') }))
      .rejects.toThrow(/[Uu]nique constraint/)
  })

  it('remplit created_at et updated_at automatiquement', async () => {
    const user = await prisma.user.create({ data: userFixture('dates') })

    expect(user.createdAt).toBeInstanceOf(Date)
    expect(user.updatedAt).toBeInstanceOf(Date)
    expect(Date.now() - user.createdAt.getTime()).toBeLessThan(60_000)
  })

  it('avance updated_at à chaque modification', async () => {
    const user = await prisma.user.create({ data: userFixture('touch') })

    await new Promise((resolve) => setTimeout(resolve, 50))
    const updated = await prisma.user.update({
      where: { id: user.id },
      data:  { emailEncrypted: 'iv:tag:autre' },
    })

    expect(updated.updatedAt.getTime()).toBeGreaterThan(user.updatedAt.getTime())
    expect(updated.createdAt.getTime()).toBe(user.createdAt.getTime())
  })
})

describe('extensions PostgreSQL', () => {
  it('uuid-ossp et pgcrypto sont installées', async () => {
    const rows = await prisma.$queryRaw<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto')
    `
    expect(rows.map((r) => r.extname).sort()).toEqual(['pgcrypto', 'uuid-ossp'])
  })
})
