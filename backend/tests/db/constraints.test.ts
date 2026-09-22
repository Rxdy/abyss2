/**
 * Contraintes d'intégrité : clés étrangères, NOT NULL, valeurs par défaut et
 * CHECK. Chaque règle est testée par une écriture invalide qui doit être
 * refusée PAR LA BASE, sous le bon nom de contrainte — l'API n'est pas dans
 * la boucle.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma, createUser, createCategory, createTransaction, createRecurring, cleanup, sqlError } from './helpers.js'

const PREFIX = 'testcst'

/** Code SQLSTATE 23502 — Prisma n'expose pas le nom de la colonne, seulement la ligne refusée. */
const NOT_NULL_VIOLATION = /23502/
let userId: string

beforeAll(async () => {
  await cleanup(PREFIX)
  userId = (await createUser(PREFIX, 'a')).id
})

afterAll(async () => {
  await cleanup(PREFIX)
  await prisma.$disconnect()
})

describe('clés étrangères', () => {
  it('refuse une catégorie rattachée à un utilisateur inexistant', async () => {
    const error = await sqlError(
      `INSERT INTO dbo.categories (user_id, name_encrypted) VALUES ($1::uuid, 'x')`,
      '00000000-0000-0000-0000-000000000000',
    )
    expect(error).toMatch(/categories_user_id_fkey/)
  })

  it('refuse une transaction rattachée à un utilisateur inexistant', async () => {
    const error = await sqlError(
      `INSERT INTO dbo.transactions (user_id, title_encrypted, amount_encrypted, date)
       VALUES ($1::uuid, 'x', 'x', '2026-01-01')`,
      '00000000-0000-0000-0000-000000000000',
    )
    expect(error).toMatch(/transactions_user_id_fkey/)
  })

  it('refuse une transaction dans une catégorie inexistante', async () => {
    const error = await sqlError(
      `INSERT INTO dbo.transactions (user_id, category_id, title_encrypted, amount_encrypted, date)
       VALUES ($1::uuid, $2::uuid, 'x', 'x', '2026-01-01')`,
      userId, '00000000-0000-0000-0000-000000000000',
    )
    expect(error).toMatch(/transactions_category_id_fkey/)
  })

  it('refuse une transaction issue d\'une charge fixe inexistante', async () => {
    const error = await sqlError(
      `INSERT INTO dbo.transactions (user_id, recurring_id, title_encrypted, amount_encrypted, date)
       VALUES ($1::uuid, $2::uuid, 'x', 'x', '2026-01-01')`,
      userId, '00000000-0000-0000-0000-000000000000',
    )
    expect(error).toMatch(/transactions_recurring_id_fkey/)
  })

  it('refuse une sous-catégorie dont le parent n\'existe pas', async () => {
    const error = await sqlError(
      `INSERT INTO dbo.categories (user_id, parent_id, name_encrypted) VALUES ($1::uuid, $2::uuid, 'x')`,
      userId, '00000000-0000-0000-0000-000000000000',
    )
    expect(error).toMatch(/categories_parent_id_fkey/)
  })

  it('refuse une enveloppe rattachée à un utilisateur inexistant', async () => {
    const error = await sqlError(
      `INSERT INTO dbo.envelopes (user_id, name_encrypted, budget_encrypted) VALUES ($1::uuid, 'x', 'x')`,
      '00000000-0000-0000-0000-000000000000',
    )
    expect(error).toMatch(/envelopes_user_id_fkey/)
  })

  it('refuse une catégorie rattachée à une enveloppe inexistante', async () => {
    const error = await sqlError(
      `INSERT INTO dbo.categories (user_id, envelope_id, name_encrypted) VALUES ($1::uuid, $2::uuid, 'x')`,
      userId, '00000000-0000-0000-0000-000000000000',
    )
    expect(error).toMatch(/categories_envelope_id_fkey/)
  })
})

describe('colonnes obligatoires', () => {
  it('refuse une transaction sans libellé chiffré', async () => {
    const error = await sqlError(
      `INSERT INTO dbo.transactions (user_id, amount_encrypted, date) VALUES ($1::uuid, 'x', '2026-01-01')`,
      userId,
    )
    expect(error).toMatch(NOT_NULL_VIOLATION)
  })

  it('refuse une transaction sans montant chiffré', async () => {
    const error = await sqlError(
      `INSERT INTO dbo.transactions (user_id, title_encrypted, date) VALUES ($1::uuid, 'x', '2026-01-01')`,
      userId,
    )
    expect(error).toMatch(NOT_NULL_VIOLATION)
  })

  it('refuse une transaction sans date', async () => {
    const error = await sqlError(
      `INSERT INTO dbo.transactions (user_id, title_encrypted, amount_encrypted) VALUES ($1::uuid, 'x', 'x')`,
      userId,
    )
    expect(error).toMatch(NOT_NULL_VIOLATION)
  })

  it('refuse une catégorie sans nom chiffré', async () => {
    const error = await sqlError(`INSERT INTO dbo.categories (user_id) VALUES ($1::uuid)`, userId)
    expect(error).toMatch(NOT_NULL_VIOLATION)
  })

  it('refuse une enveloppe sans nom chiffré', async () => {
    const error = await sqlError(
      `INSERT INTO dbo.envelopes (user_id, budget_encrypted) VALUES ($1::uuid, 'x')`, userId,
    )
    expect(error).toMatch(NOT_NULL_VIOLATION)
  })

  it('refuse une enveloppe sans montant alloué chiffré', async () => {
    const error = await sqlError(
      `INSERT INTO dbo.envelopes (user_id, name_encrypted) VALUES ($1::uuid, 'x')`, userId,
    )
    expect(error).toMatch(NOT_NULL_VIOLATION)
  })

  it('refuse d\'écrire NULL dans created_at / updated_at', async () => {
    const error = await sqlError(
      `INSERT INTO dbo.categories (user_id, name_encrypted, created_at) VALUES ($1::uuid, 'x', NULL)`,
      userId,
    )
    expect(error).toMatch(NOT_NULL_VIOLATION)
  })
})

describe('valeurs par défaut', () => {
  it('une transaction sans type est une dépense', async () => {
    const created = await createTransaction(userId)
    expect(created.type).toBe('expense')
  })

  it('une charge fixe est active par défaut', async () => {
    const created = await createRecurring(userId)
    expect(created.active).toBe(true)
    expect(created.type).toBe('expense')
  })

  it('un utilisateur démarre avec token_version = 0', async () => {
    const [row] = await prisma.$queryRaw<{ token_version: number }[]>`
      SELECT token_version FROM dbo.users WHERE id = ${userId}::uuid
    `
    expect(row.token_version).toBe(0)
  })
})

describe('contraintes CHECK', () => {
  const insertTransaction = (type: string) => sqlError(
    `INSERT INTO dbo.transactions (user_id, title_encrypted, amount_encrypted, date, type)
     VALUES ($1::uuid, 'x', 'x', '2026-01-01', $2)`,
    userId, type,
  )

  const insertRecurring = (columns: string, values: string) => sqlError(
    `INSERT INTO dbo.recurring_transactions (user_id, title_encrypted, amount_encrypted, ${columns})
     VALUES ($1::uuid, 'x', 'x', ${values})`,
    userId,
  )

  it.each(['expense', 'income'])('accepte le type de transaction « %s »', async (type) => {
    expect(await insertTransaction(type)).toBeNull()
  })

  it.each(['', 'transfer', 'EXPENSE', 'depense'])('refuse le type de transaction « %s »', async (type) => {
    expect(await insertTransaction(type)).toMatch(/chk_transactions_type/)
  })

  it('refuse un type de charge fixe invalide', async () => {
    expect(await insertRecurring('type, day_of_month, start_date', `'refund', 5, '2026-01-01'`))
      .toMatch(/chk_recurring_type/)
  })

  it.each([1, 15, 31])('accepte le jour d\'échéance %i', async (day) => {
    expect(await insertRecurring('day_of_month, start_date', `${day}, '2026-01-01'`)).toBeNull()
  })

  it.each([0, 32, -1])('refuse le jour d\'échéance %i', async (day) => {
    expect(await insertRecurring('day_of_month, start_date', `${day}, '2026-01-01'`))
      .toMatch(/chk_recurring_day_of_month/)
  })

  it('refuse une fin antérieure au début', async () => {
    expect(await insertRecurring('day_of_month, start_date, end_date', `5, '2026-06-01', '2026-05-31'`))
      .toMatch(/chk_recurring_dates/)
  })

  it('accepte une fin égale au début, ou l\'absence de fin', async () => {
    expect(await insertRecurring('day_of_month, start_date, end_date', `5, '2026-06-01', '2026-06-01'`)).toBeNull()
    expect(await insertRecurring('day_of_month, start_date', `5, '2026-06-01'`)).toBeNull()
  })

  it.each(['2026-09', '2026-12', '1999-01'])('accepte le mois de génération « %s »', async (month) => {
    expect(await insertRecurring('day_of_month, start_date, last_generated_month', `5, '2026-01-01', '${month}'`)).toBeNull()
  })

  it.each(['2026-13', '2026-00', '26-09', '2026/09', 'septembre'])('refuse le mois de génération « %s »', async (month) => {
    expect(await insertRecurring('day_of_month, start_date, last_generated_month', `5, '2026-01-01', '${month}'`))
      .toMatch(/chk_recurring_last_month|value too long/)
  })

  it.each(['#488efe', '#4DDE93', '#000000'])('accepte la couleur « %s »', async (color) => {
    expect(await sqlError(`INSERT INTO dbo.categories (user_id, name_encrypted, color) VALUES ($1::uuid, 'x', $2)`, userId, color)).toBeNull()
  })

  it.each(['red', '488efe', '#48f', '#gggggg', '#12345g'])('refuse la couleur « %s »', async (color) => {
    expect(await sqlError(`INSERT INTO dbo.categories (user_id, name_encrypted, color) VALUES ($1::uuid, 'x', $2)`, userId, color))
      .toMatch(/chk_categories_color/)
  })

  it('accepte une catégorie sans couleur', async () => {
    const created = await createCategory(userId, { color: null })
    expect(created.color).toBeNull()
  })

  it('refuse qu\'une catégorie soit son propre parent', async () => {
    const category = await createCategory(userId)

    const error = await sqlError(`UPDATE dbo.categories SET parent_id = id WHERE id = $1::uuid`, category.id)

    expect(error).toMatch(/chk_categories_not_own_parent/)
  })

  it('refuse un token_version négatif', async () => {
    expect(await sqlError(`UPDATE dbo.users SET token_version = -1 WHERE id = $1::uuid`, userId))
      .toMatch(/chk_users_token_version/)
  })
})

describe('unicité des échéances de charges fixes', () => {
  const insert = (recurringId: string | null, date: string) =>
    sqlError(
      `INSERT INTO dbo.transactions (user_id, recurring_id, title_encrypted, amount_encrypted, date)
       VALUES ($1::uuid, $2::uuid, 'x', 'x', $3::date)`,
      userId, recurringId, date,
    )

  it('refuse deux transactions d\'une même charge fixe à la même date', async () => {
    const recurring = await createRecurring(userId)

    expect(await insert(recurring.id, '2026-03-05')).toBeNull()
    // 23505 = unique_violation ; Prisma cite les colonnes de l'index, pas son nom.
    expect(await insert(recurring.id, '2026-03-05')).toMatch(/23505[\s\S]*\(recurring_id, date\)/)
  })

  it('accepte la même date pour deux charges fixes différentes', async () => {
    const [a, b] = [await createRecurring(userId), await createRecurring(userId)]

    expect(await insert(a.id, '2026-04-05')).toBeNull()
    expect(await insert(b.id, '2026-04-05')).toBeNull()
  })

  it('accepte des dates différentes pour une même charge fixe', async () => {
    const recurring = await createRecurring(userId)

    expect(await insert(recurring.id, '2026-05-05')).toBeNull()
    expect(await insert(recurring.id, '2026-06-05')).toBeNull()
  })

  it('ne concerne pas les transactions saisies à la main (recurring_id NULL)', async () => {
    expect(await insert(null, '2026-07-05')).toBeNull()
    expect(await insert(null, '2026-07-05')).toBeNull()
  })

  it('skipDuplicates (ON CONFLICT DO NOTHING) ignore le doublon sans faire échouer la transaction', async () => {
    const recurring = await createRecurring(userId)
    const row = {
      userId, recurringId: recurring.id, titleEncrypted: 'x', amountEncrypted: 'x', date: new Date('2026-08-05'),
    }

    const first  = await prisma.transaction.createMany({ data: [row], skipDuplicates: true })
    const second = await prisma.transaction.createMany({ data: [row], skipDuplicates: true })

    expect([first.count, second.count]).toEqual([1, 0])
    expect(await prisma.transaction.count({ where: { recurringId: recurring.id } })).toBe(1)
  })

  it('deux rattrapages simultanés ne créent qu\'une fois chaque échéance', async () => {
    const recurring = await createRecurring(userId)
    const rows = ['2026-09-05', '2026-10-05', '2026-11-05'].map((date) => ({
      userId, recurringId: recurring.id, titleEncrypted: 'x', amountEncrypted: 'x', date: new Date(date),
    }))

    const results = await Promise.all(
      Array.from({ length: 8 }, () => prisma.$transaction((tx) => tx.transaction.createMany({ data: rows, skipDuplicates: true }))),
    )

    expect(results.reduce((total, r) => total + r.count, 0)).toBe(3)
    expect(await prisma.transaction.count({ where: { recurringId: recurring.id } })).toBe(3)
  })

  it('supprimer la charge fixe détache ses transactions, qui peuvent alors coexister', async () => {
    const recurring = await createRecurring(userId)
    await insert(recurring.id, '2026-12-05')
    await prisma.recurringTransaction.delete({ where: { id: recurring.id } })

    const orphan = await prisma.transaction.findFirst({ where: { userId, date: new Date('2026-12-05'), recurringId: null } })
    expect(orphan).not.toBeNull()
    expect(await insert(null, '2026-12-05')).toBeNull()
  })
})

