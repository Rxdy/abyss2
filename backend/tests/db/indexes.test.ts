/**
 * Index attendus : ceux qui servent les requêtes de l'API (filtres par
 * utilisateur, par période, par catégorie). Un index supprimé par erreur ne
 * casse aucun test fonctionnel — seulement les performances, en silence.
 */

import { describe, it, expect, afterAll } from 'vitest'
import { prisma } from './helpers.js'

afterAll(() => prisma.$disconnect())

/** Colonnes de chaque index de dbo, dans l'ordre : { table: ['a,b', …] }. */
async function indexedColumns() {
  const rows = await prisma.$queryRaw<{ table_name: string; cols: string }[]>`
    SELECT t.relname AS table_name,
           string_agg(a.attname, ',' ORDER BY k.ord) AS cols
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
    WHERE n.nspname = 'dbo'
    GROUP BY t.relname, i.indexrelid
  `
  const byTable: Record<string, string[]> = {}
  for (const row of rows) (byTable[row.table_name] ??= []).push(row.cols)
  return byTable
}

const EXPECTED: Record<string, string[]> = {
  users:                  ['id', 'email_hash'],
  categories:             ['id', 'user_id', 'parent_id', 'envelope_id'],
  envelopes:              ['id', 'user_id'],
  transactions:           ['id', 'user_id', 'user_id,date', 'category_id', 'recurring_id', 'recurring_id,date'],
  recurring_transactions: ['id', 'user_id'],
}

describe('index', () => {
  for (const [table, expected] of Object.entries(EXPECTED)) {
    it(`dbo.${table} : ${expected.join(' · ')}`, async () => {
      const indexes = (await indexedColumns())[table] ?? []

      for (const columns of expected) {
        expect(indexes, `index sur (${columns})`).toContain(columns)
      }
    })
  }
})
