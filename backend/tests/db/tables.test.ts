/**
 * Structure physique des tables (catégories, transactions, charges fixes) :
 * colonnes, types, nullabilité, valeurs par défaut. Complète schema.test.ts
 * qui couvre la table users.
 */

import { describe, it, expect, afterAll } from 'vitest'
import { prisma, columnsOf } from './helpers.js'

afterAll(() => prisma.$disconnect())

type Spec = Record<string, [type: string, nullable: boolean, length?: number]>

const TS = 'timestamp with time zone'

const EXPECTED: Record<string, Spec> = {
  categories: {
    id: ['uuid', false], user_id: ['uuid', false], parent_id: ['uuid', true],
    name_encrypted: ['text', false], color: ['character varying', true, 7], position: ['integer', true],
    budget_encrypted: ['text', true], envelope_id: ['uuid', true],
    created_at: [TS, false], updated_at: [TS, false],
  },
  envelopes: {
    id: ['uuid', false], user_id: ['uuid', false],
    name_encrypted: ['text', false], budget_encrypted: ['text', false],
    created_at: [TS, false], updated_at: [TS, false],
  },
  notifications: {
    id: ['uuid', false], user_id: ['uuid', false], type: ['character varying', false, 30],
    envelope_id: ['uuid', true], count: ['integer', true],
    read: ['boolean', false], archived: ['boolean', false],
    created_at: [TS, false],
  },
  transactions: {
    id: ['uuid', false], user_id: ['uuid', false], category_id: ['uuid', true], recurring_id: ['uuid', true],
    title_encrypted: ['text', false], amount_encrypted: ['text', false],
    date: ['date', false], type: ['character varying', false, 20], note: ['text', true],
    created_at: [TS, false], updated_at: [TS, false],
  },
  recurring_transactions: {
    id: ['uuid', false], user_id: ['uuid', false], category_id: ['uuid', true],
    title_encrypted: ['text', false], amount_encrypted: ['text', false],
    type: ['character varying', false, 20], day_of_month: ['integer', false], note: ['text', true],
    active: ['boolean', false], start_date: ['date', false], end_date: ['date', true],
    last_generated_month: ['character varying', true, 7],
    created_at: [TS, false], updated_at: [TS, false],
  },
}

for (const [table, spec] of Object.entries(EXPECTED)) {
  describe(`table dbo.${table}`, () => {
    it('a exactement les colonnes attendues', async () => {
      expect(Object.keys(await columnsOf(table)).sort()).toEqual(Object.keys(spec).sort())
    })

    it('respecte types, longueurs et nullabilité', async () => {
      const columns = await columnsOf(table)

      for (const [name, [type, nullable, length]] of Object.entries(spec)) {
        expect(columns[name].type, `${name}.type`).toBe(type)
        expect(columns[name].nullable, `${name}.nullable`).toBe(nullable)
        if (length !== undefined) expect(columns[name].length, `${name}.length`).toBe(length)
      }
    })
  })
}

describe('confidentialité des colonnes', () => {
  it('ne stocke en clair ni libellé ni montant : ils sont chiffrés', async () => {
    for (const table of ['transactions', 'recurring_transactions']) {
      const names = Object.keys(await columnsOf(table))

      expect(names, table).toContain('title_encrypted')
      expect(names, table).toContain('amount_encrypted')
      expect(names, table).not.toContain('title')
      expect(names, table).not.toContain('amount')
    }
  })

  it('chiffre le nom des catégories', async () => {
    const names = Object.keys(await columnsOf('categories'))

    expect(names).toContain('name_encrypted')
    expect(names).not.toContain('name')
  })

  it('chiffre le nom et le montant alloué des enveloppes', async () => {
    const names = Object.keys(await columnsOf('envelopes'))

    expect(names).toContain('name_encrypted')
    expect(names).toContain('budget_encrypted')
    expect(names).not.toContain('name')
    expect(names).not.toContain('budget')
  })
})

describe('valeurs par défaut', () => {
  it('génère les identifiants et les horodatages', async () => {
    for (const table of Object.keys(EXPECTED)) {
      const columns = await columnsOf(table)

      expect(columns.id.hasDefault, `${table}.id`).toBe(true)
      expect(columns.created_at.hasDefault, `${table}.created_at`).toBe(true)
      // notifications n'a pas de updated_at : jamais modifiée en place au sens du contenu.
      if (columns.updated_at) expect(columns.updated_at.hasDefault, `${table}.updated_at`).toBe(true)
    }
  })

  it('une notification part non lue et non archivée', async () => {
    const columns = await columnsOf('notifications')
    expect(columns.read.hasDefault).toBe(true)
    expect(columns.archived.hasDefault).toBe(true)
  })

  it('une transaction est une dépense par défaut, une charge fixe est active', async () => {
    expect((await columnsOf('transactions')).type.hasDefault).toBe(true)
    expect((await columnsOf('recurring_transactions')).type.hasDefault).toBe(true)
    expect((await columnsOf('recurring_transactions')).active.hasDefault).toBe(true)
  })
})
