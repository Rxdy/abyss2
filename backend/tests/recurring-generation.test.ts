/**
 * Tests unitaires — runDueRecurring : génération sans doublon, même en cas
 * de rattrapages simultanés (l'unicité (charge fixe, date) est portée par la base).
 */

import { describe, it, expect } from 'vitest'
import { runDueRecurring } from '../src/utils/recurring.js'

const USER_ID = 'user-1'

const template = (over: any = {}) => ({
  id: 'rec-1', userId: USER_ID, categoryId: 'cat-1', titleEncrypted: 'enc-title', amountEncrypted: 'enc-amount',
  type: 'expense', dayOfMonth: 5, note: null, active: true,
  startDate: new Date('2026-01-05'), endDate: null, lastGeneratedMonth: null,
  ...over,
})

/**
 * Faux Prisma qui imite l'index unique (recurring_id, date) : createMany avec
 * skipDuplicates n'insère que ce qui n'existe pas encore, comme ON CONFLICT DO NOTHING.
 */
function fakePrisma(recurringList: any[]) {
  const rows = new Map<string, any>()
  const lastGenerated: Record<string, string> = {}
  const createMany = async ({ data, skipDuplicates }: any) => {
    let count = 0
    for (const row of data) {
      const key = `${row.recurringId}|${row.date.toISOString().slice(0, 10)}`
      if (rows.has(key)) {
        if (!skipDuplicates) throw Object.assign(new Error('unique violation'), { code: 'P2002' })
        continue
      }
      rows.set(key, row)
      count++
    }
    return { count }
  }
  const prisma: any = {
    recurringTransaction: {
      findMany: async () => recurringList,
      update: async ({ where, data }: any) => { lastGenerated[where.id] = data.lastGeneratedMonth },
    },
    transaction: { createMany },
    $transaction: async (fn: any) => fn(prisma),
  }
  return { prisma, rows, lastGenerated, createMany }
}

const NOW = new Date('2026-04-20T10:00:00Z') // échéances dues : janvier, février, mars, avril

describe('runDueRecurring', () => {
  it('crée une transaction par mois dû, recopie le ciphertext et renvoie leur nombre', async () => {
    const { prisma, rows } = fakePrisma([template()])

    const created = await runDueRecurring(prisma, USER_ID, { now: NOW })

    expect(created).toBe(4)
    expect([...rows.keys()].sort()).toEqual(['rec-1|2026-01-05', 'rec-1|2026-02-05', 'rec-1|2026-03-05', 'rec-1|2026-04-05'])
    expect(rows.get('rec-1|2026-01-05')).toMatchObject({
      userId: USER_ID, categoryId: 'cat-1', recurringId: 'rec-1',
      titleEncrypted: 'enc-title', amountEncrypted: 'enc-amount', type: 'expense',
    })
  })

  it('avance le marqueur au dernier mois généré', async () => {
    const { prisma, lastGenerated } = fakePrisma([template()])

    await runDueRecurring(prisma, USER_ID, { now: NOW })

    expect(lastGenerated['rec-1']).toBe('2026-04')
  })

  it('n\'écrit rien quand tout est déjà à jour', async () => {
    const { prisma, rows, lastGenerated } = fakePrisma([template({ lastGeneratedMonth: '2026-04' })])

    expect(await runDueRecurring(prisma, USER_ID, { now: NOW })).toBe(0)
    expect(rows.size).toBe(0)
    expect(lastGenerated).toEqual({})
  })

  it('demande toujours skipDuplicates à la base', async () => {
    const { prisma } = fakePrisma([template()])
    let seen: any
    const original = prisma.transaction.createMany
    prisma.transaction.createMany = async (args: any) => { seen = args; return original(args) }

    await runDueRecurring(prisma, USER_ID, { now: NOW })

    expect(seen.skipDuplicates).toBe(true)
  })

  it('reprend là où il s\'était arrêté', async () => {
    const { prisma, rows } = fakePrisma([template({ lastGeneratedMonth: '2026-02' })])

    expect(await runDueRecurring(prisma, USER_ID, { now: NOW })).toBe(2)
    expect([...rows.keys()].sort()).toEqual(['rec-1|2026-03-05', 'rec-1|2026-04-05'])
  })

  it('traite chaque charge fixe séparément', async () => {
    const { prisma, rows } = fakePrisma([template(), template({ id: 'rec-2', dayOfMonth: 20 })])

    expect(await runDueRecurring(prisma, USER_ID, { now: NOW })).toBe(8)
    expect(rows.size).toBe(8)
  })

  it('ignore une charge terminée', async () => {
    const { prisma, rows } = fakePrisma([template({ endDate: new Date('2026-02-28') })])

    expect(await runDueRecurring(prisma, USER_ID, { now: NOW })).toBe(2)
    expect([...rows.keys()].sort()).toEqual(['rec-1|2026-01-05', 'rec-1|2026-02-05'])
  })
})

describe('runDueRecurring — rattrapages simultanés', () => {
  it('lancé 10 fois en parallèle, chaque échéance n\'est créée qu\'une seule fois', async () => {
    const { prisma, rows } = fakePrisma([template()])

    const counts = await Promise.all(Array.from({ length: 10 }, () => runDueRecurring(prisma, USER_ID, { now: NOW })))

    expect(rows.size).toBe(4)
    // Toutes les insertions effectives, tous appels confondus, font exactement 4.
    expect(counts.reduce((a, b) => a + b, 0)).toBe(4)
  })

  it('un doublon déjà en base n\'est pas recréé et ne fait pas échouer le rattrapage', async () => {
    const { prisma, rows } = fakePrisma([template()])
    rows.set('rec-1|2026-02-05', { pre: 'existante' })

    expect(await runDueRecurring(prisma, USER_ID, { now: NOW })).toBe(3)
    expect(rows.get('rec-1|2026-02-05')).toEqual({ pre: 'existante' })
  })
})
