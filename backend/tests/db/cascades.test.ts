/**
 * Comportement des suppressions : ce qui disparaît (CASCADE), ce qui est
 * conservé mais détaché (SET NULL). C'est la garantie derrière le droit à
 * l'effacement (DELETE /api/user) et derrière « supprimer une catégorie ne
 * supprime pas les transactions ».
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma, createUser, createCategory, createTransaction, createRecurring, createResetToken, createEnvelope, createNotification, cleanup } from './helpers.js'

const PREFIX = 'testcas'

beforeAll(() => cleanup(PREFIX))
afterAll(async () => {
  await cleanup(PREFIX)
  await prisma.$disconnect()
})

describe('suppression d\'un utilisateur (droit à l\'effacement)', () => {
  it('emporte toutes ses données, sans toucher à celles des autres', async () => {
    const alice = await createUser(PREFIX, 'alice')
    const bob   = await createUser(PREFIX, 'bob')

    const aliceCategory  = await createCategory(alice.id)
    const aliceRecurring = await createRecurring(alice.id, { categoryId: aliceCategory.id })
    await createTransaction(alice.id, { categoryId: aliceCategory.id, recurringId: aliceRecurring.id })
    await createTransaction(alice.id)
    await createResetToken(alice.id)
    await createEnvelope(alice.id)
    await createNotification(alice.id)
    const bobCategory = await createCategory(bob.id)
    await createTransaction(bob.id, { categoryId: bobCategory.id })

    await prisma.user.delete({ where: { id: alice.id } })

    const remaining = async (table: string, id: string) => Number(
      (await prisma.$queryRawUnsafe<{ n: bigint }[]>(`SELECT COUNT(*) AS n FROM dbo.${table} WHERE user_id = $1::uuid`, id))[0].n,
    )

    for (const table of ['categories', 'transactions', 'recurring_transactions', 'password_reset_tokens', 'envelopes', 'notifications']) {
      expect(await remaining(table, alice.id), `${table} d'Alice`).toBe(0)
    }
    expect(await remaining('categories', bob.id)).toBe(1)
    expect(await remaining('transactions', bob.id)).toBe(1)
  })
})

describe('suppression d\'une enveloppe', () => {
  it('conserve les catégories liées, simplement détachées', async () => {
    const user = await createUser(PREFIX, 'env')
    const envelope = await createEnvelope(user.id)
    const category = await createCategory(user.id)
    await prisma.category.update({ where: { id: category.id }, data: { envelopeId: envelope.id } })

    await prisma.envelope.delete({ where: { id: envelope.id } })

    const after = await prisma.category.findUnique({ where: { id: category.id } })
    expect(after).not.toBeNull()
    expect(after!.envelopeId).toBeNull()
  })

  it('conserve les notifications liées, devenues génériques (envelope_id détaché)', async () => {
    const user = await createUser(PREFIX, 'envnotif')
    const envelope = await createEnvelope(user.id)
    const notification = await createNotification(user.id, { envelopeId: envelope.id })

    await prisma.envelope.delete({ where: { id: envelope.id } })

    const after = await prisma.notification.findUnique({ where: { id: notification.id } })
    expect(after).not.toBeNull()
    expect(after!.envelopeId).toBeNull()
  })
})

describe('suppression d\'une catégorie', () => {
  it('conserve les transactions, simplement sans catégorie', async () => {
    const user = await createUser(PREFIX, 'cat')
    const category = await createCategory(user.id)
    const transaction = await createTransaction(user.id, { categoryId: category.id })

    await prisma.category.delete({ where: { id: category.id } })

    const after = await prisma.transaction.findUnique({ where: { id: transaction.id } })
    expect(after).not.toBeNull()
    expect(after!.categoryId).toBeNull()
  })

  it('conserve les charges fixes, sans catégorie', async () => {
    const user = await createUser(PREFIX, 'catrec')
    const category = await createCategory(user.id)
    const recurring = await createRecurring(user.id, { categoryId: category.id })

    await prisma.category.delete({ where: { id: category.id } })

    const after = await prisma.recurringTransaction.findUnique({ where: { id: recurring.id } })
    expect(after!.categoryId).toBeNull()
  })

  it('promeut les sous-catégories au premier niveau au lieu de les supprimer', async () => {
    const user = await createUser(PREFIX, 'tree')
    const parent = await createCategory(user.id)
    const child  = await createCategory(user.id, { parentId: parent.id })

    await prisma.category.delete({ where: { id: parent.id } })

    const after = await prisma.category.findUnique({ where: { id: child.id } })
    expect(after).not.toBeNull()
    expect(after!.parentId).toBeNull()
  })
})

describe('suppression d\'une charge fixe', () => {
  it('conserve l\'historique déjà généré, détaché du modèle', async () => {
    const user = await createUser(PREFIX, 'rec')
    const recurring = await createRecurring(user.id)
    const generated = await createTransaction(user.id, { recurringId: recurring.id })

    await prisma.recurringTransaction.delete({ where: { id: recurring.id } })

    const after = await prisma.transaction.findUnique({ where: { id: generated.id } })
    expect(after).not.toBeNull()
    expect(after!.recurringId).toBeNull()
  })
})
