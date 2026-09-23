/**
 * Cohérence schema.prisma ↔ base réelle.
 *
 * Deux sources de vérité coexistent : `prisma/schema.prisma` (ce que le code
 * croit) et `prisma/migrations` (ce qui construit la base). Ce test compare
 * le premier à la base RÉELLEMENT en place — types, nullabilité, longueurs,
 * index, clés étrangères — pour qu'une divergence casse la CI au lieu
 * d'exploser en production (par exemple : un champ ajouté à schema.prisma
 * sans migration correspondante).
 */

import { describe, it, expect, afterAll } from 'vitest'
import { prisma, columnsOf } from './helpers.js'
import { parseSchema, type PrismaField } from './prisma-schema.js'

afterAll(() => prisma.$disconnect())

const models = parseSchema()

/** Type PostgreSQL attendu pour un champ scalaire Prisma. */
function expectedPgType(field: PrismaField) {
  switch (field.type) {
    case 'Int':      return 'integer'
    case 'Boolean':  return 'boolean'
    case 'DateTime': return field.native === 'Date' ? 'date' : field.native === 'Timestamptz' ? 'timestamp with time zone' : 'timestamp without time zone'
    case 'String':   return field.native === 'Uuid' ? 'uuid' : field.native === 'VarChar' ? 'character varying' : 'text'
    default:         return `?${field.type}`
  }
}

describe('schema.prisma ↔ base', () => {
  it('couvre les cinq modèles', () => {
    expect(models.map((m) => m.table).sort()).toEqual([
      'categories', 'password_reset_tokens', 'recurring_transactions', 'transactions', 'users',
    ])
  })

  for (const model of models) {
    const { table, fields } = model

    describe(`${model.name} → dbo.${table}`, () => {
      it('a les mêmes colonnes des deux côtés', async () => {
        expect(Object.keys(await columnsOf(table)).sort()).toEqual(fields.map((f) => f.column).sort())
      })

      it('mêmes types', async () => {
        const columns = await columnsOf(table)

        for (const field of fields) {
          expect(columns[field.column].type, field.name).toBe(expectedPgType(field))
        }
      })

      it('mêmes longueurs pour les VarChar', async () => {
        const columns = await columnsOf(table)

        for (const field of fields.filter((f) => f.native === 'VarChar')) {
          expect(columns[field.column].length, field.name).toBe(field.length)
        }
      })

      it('même nullabilité (un champ Prisma obligatoire est NOT NULL en base)', async () => {
        const columns = await columnsOf(table)

        for (const field of fields) {
          expect(columns[field.column].nullable, field.name).toBe(field.optional)
        }
      })

      it('mêmes valeurs par défaut', async () => {
        const columns = await columnsOf(table)

        for (const field of fields.filter((f) => f.hasDefault)) {
          expect(columns[field.column].hasDefault, field.name).toBe(true)
        }
      })
    })
  }

  it('mêmes clés étrangères, avec la même règle de suppression', async () => {
    const dbForeignKeys = await prisma.$queryRaw<{ table_name: string; column_name: string; ref_table: string; delete_rule: string }[]>`
      SELECT tc.table_name, kcu.column_name, ccu.table_name AS ref_table, rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
      WHERE tc.table_schema = 'dbo' AND tc.constraint_type = 'FOREIGN KEY'
    `

    const RULES: Record<string, string> = { Cascade: 'CASCADE', SetNull: 'SET NULL', Restrict: 'RESTRICT', NoAction: 'NO ACTION' }
    const tableOf = (modelName: string) => models.find((m) => m.name === modelName)!.table

    let checked = 0
    for (const model of models) {
      for (const relation of model.relations) {
        const match = dbForeignKeys.find(
          (fk) => fk.table_name === model.table && fk.column_name === relation.fromColumn && fk.ref_table === tableOf(relation.target),
        )

        expect(match, `${model.name}.${relation.field} → ${relation.target}`).toBeDefined()
        if (relation.onDelete) {
          expect(match!.delete_rule, `${model.name}.${relation.field} ON DELETE`).toBe(RULES[relation.onDelete])
        }
        checked++
      }
    }

    // Toute clé étrangère de la base est déclarée côté Prisma, et inversement
    expect(dbForeignKeys.length).toBe(checked)
    expect(checked).toBeGreaterThanOrEqual(7)
  })

  it('mêmes index (@@index / @unique) — comparés par colonnes', async () => {
    const rows = await prisma.$queryRaw<{ table_name: string; cols: string; is_unique: boolean }[]>`
      SELECT t.relname AS table_name, i.indisunique AS is_unique,
             string_agg(a.attname, ',' ORDER BY k.ord) AS cols
      FROM pg_index i
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      CROSS JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord)
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
      WHERE n.nspname = 'dbo'
      GROUP BY t.relname, i.indexrelid, i.indisunique
    `

    for (const model of models) {
      const inDb = rows.filter((r) => r.table_name === model.table)

      const wanted = [
        ...model.indexes.map((index) => ({ cols: index.columns.join(','), unique: false })),
        ...model.fields.filter((f) => f.unique).map((f) => ({ cols: f.column, unique: true })),
      ]

      for (const { cols, unique } of wanted) {
        const found = inDb.some((r) => r.cols === cols && (!unique || r.is_unique))
        expect(found, `${model.name} : index${unique ? ' unique' : ''} sur (${cols})`).toBe(true)
      }
    }
  })
})
