/**
 * Déclencheurs updated_at : chaque table doit horodater ses modifications,
 * quel que soit le chemin d'écriture (API, script, psql).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma, createUser, createCategory, createTransaction, createRecurring, createEnvelope, cleanup } from './helpers.js'

const PREFIX = 'testtrg'
let userId: string

beforeAll(async () => {
  await cleanup(PREFIX)
  userId = (await createUser(PREFIX, 'a')).id
})

afterAll(async () => {
  await cleanup(PREFIX)
  await prisma.$disconnect()
})

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Modifie une ligne en SQL brut (le trigger ne dépend pas de Prisma) et renvoie les deux horodatages. */
async function touch(table: string, id: string, setClause: string) {
  const read = async () => (await prisma.$queryRawUnsafe<{ updated_at: Date }[]>(
    `SELECT updated_at FROM dbo.${table} WHERE id = $1::uuid`, id,
  ))[0].updated_at

  const before = await read()
  await wait(20)
  await prisma.$executeRawUnsafe(`UPDATE dbo.${table} SET ${setClause} WHERE id = $1::uuid`, id)
  return { before, after: await read() }
}

describe('trigger updated_at', () => {
  it('categories', async () => {
    const row = await createCategory(userId)
    const { before, after } = await touch('categories', row.id, `position = 3`)
    expect(after.getTime()).toBeGreaterThan(before.getTime())
  })

  it('transactions', async () => {
    const row = await createTransaction(userId)
    const { before, after } = await touch('transactions', row.id, `note = 'modifiée'`)
    expect(after.getTime()).toBeGreaterThan(before.getTime())
  })

  it('recurring_transactions', async () => {
    const row = await createRecurring(userId)
    const { before, after } = await touch('recurring_transactions', row.id, `active = false`)
    expect(after.getTime()).toBeGreaterThan(before.getTime())
  })

  it('envelopes', async () => {
    const row = await createEnvelope(userId)
    const { before, after } = await touch('envelopes', row.id, `name_encrypted = 'iv:tag:renamed'`)
    expect(after.getTime()).toBeGreaterThan(before.getTime())
  })

  it('ne modifie pas created_at', async () => {
    const row = await createTransaction(userId)
    await wait(20)
    await prisma.$executeRawUnsafe(`UPDATE dbo.transactions SET note = 'x' WHERE id = $1::uuid`, row.id)

    const [after] = await prisma.$queryRaw<{ created_at: Date }[]>`
      SELECT created_at FROM dbo.transactions WHERE id = ${row.id}::uuid
    `
    expect(after.created_at.getTime()).toBe(row.createdAt.getTime())
  })

  it('chaque table porte son trigger, branché sur set_updated_at()', async () => {
    const rows = await prisma.$queryRaw<{ table_name: string; function_name: string }[]>`
      SELECT c.relname AS table_name, p.proname AS function_name
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_proc p ON p.oid = t.tgfoid
      WHERE n.nspname = 'dbo' AND NOT t.tgisinternal
    `
    const byTable = Object.fromEntries(rows.map((r) => [r.table_name, r.function_name]))

    for (const table of ['users', 'categories', 'transactions', 'recurring_transactions', 'envelopes']) {
      expect(byTable[table], table).toBe('set_updated_at')
    }
  })
})
