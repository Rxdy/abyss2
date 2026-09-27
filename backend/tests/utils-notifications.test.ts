/**
 * Tests — génération des notifications (utils/notifications.ts)
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'

beforeAll(() => {
  process.env.MASTER_SECRET = 'b'.repeat(64)
})

const { encryptValue } = await import('../src/utils/crypto.js')
const { notifyAfterChange, maybeCreateUncategorizedDigest } = await import('../src/utils/notifications.js')

const USER_ID = '11111111-1111-1111-1111-111111111111'
const CAT_ID  = '22222222-2222-2222-2222-222222222222'
const ENV_ID  = '55555555-5555-5555-5555-555555555555'

// Toutes les dates « du mois courant » des tests sont relatives à NOW.
const NOW        = new Date('2026-09-23T10:00:00Z')
const THIS_MONTH = new Date('2026-09-15T00:00:00Z')
const LAST_MONTH = new Date('2026-08-15T00:00:00Z')

const enc = (cents: number) => encryptValue(String(cents), 'transaction-amount')
const expenseRow = (cents: number) => ({ amountEncrypted: enc(cents), type: 'expense' })
const incomeRow  = (cents: number) => ({ amountEncrypted: enc(cents), type: 'income' })

/**
 * `envelopeRows` : dépenses du mois de l'enveloppe (requête filtrée par catégorie) ;
 * `allRows` : toutes les transactions (calcul du solde global).
 */
function mockPrisma({ envelopeRows = [] as unknown[], allRows = [] as unknown[] } = {}) {
  return {
    category: {
      findMany: vi.fn().mockResolvedValue([{ id: CAT_ID, envelopeId: ENV_ID }]),
    },
    envelope: {
      findFirst: vi.fn().mockResolvedValue({
        budgetEncrypted: encryptValue('40000', 'envelope-budget'),
        categories: [{ id: CAT_ID }],
      }),
    },
    transaction: {
      findMany: vi.fn(({ where }) => Promise.resolve(where.categoryId ? envelopeRows : allRows)),
      count:    vi.fn().mockResolvedValue(0),
    },
    notification: { create: vi.fn() },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        lastUncategorizedDigestAt: null,
        notifyEnvelopeOverspend: true, notifyNegativeBalance: true, notifyUncategorizedDigest: true,
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  } as any
}

const expense = (amount: number, date = THIS_MONTH, categoryId: string | null = CAT_ID) =>
  ({ categoryId, amount, date, type: 'expense' })
const income = (amount: number, date = THIS_MONTH) =>
  ({ categoryId: null, amount, date, type: 'income' })

const createdTypes = (prisma: any) => prisma.notification.create.mock.calls.map(([arg]: any) => arg.data.type)

describe('notifyAfterChange — enveloppe dépassée', () => {
  it('sans catégorie : ne regarde aucune enveloppe', async () => {
    const prisma = mockPrisma({ allRows: [incomeRow(100000), expenseRow(5000)] })
    await notifyAfterChange(prisma, USER_ID, { added: [expense(5000, THIS_MONTH, null)] }, NOW)
    expect(prisma.category.findMany).not.toHaveBeenCalled()
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('catégorie sans enveloppe : ne notifie pas', async () => {
    const prisma = mockPrisma({ allRows: [incomeRow(100000)] })
    prisma.category.findMany.mockResolvedValue([{ id: CAT_ID, envelopeId: null }])

    await notifyAfterChange(prisma, USER_ID, { added: [expense(5000)] }, NOW)

    expect(prisma.envelope.findFirst).not.toHaveBeenCalled()
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('reste sous le plafond : pas de notification', async () => {
    const prisma = mockPrisma({ envelopeRows: [expenseRow(10000)], allRows: [incomeRow(100000)] })
    await notifyAfterChange(prisma, USER_ID, { added: [expense(10000)] }, NOW)
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('franchit le plafond avec cette transaction : notifie', async () => {
    // Budget 400 € ; total après = 420 €, la dépense de 50 € vient de faire franchir le seuil.
    const prisma = mockPrisma({ envelopeRows: [expenseRow(37000), expenseRow(5000)], allRows: [incomeRow(100000)] })

    await notifyAfterChange(prisma, USER_ID, { added: [expense(5000)] }, NOW)

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, type: 'envelope_overspend', envelopeId: ENV_ID },
    })
  })

  it('déjà au-dessus avant cette transaction : ne notifie pas à nouveau', async () => {
    const prisma = mockPrisma({ envelopeRows: [expenseRow(41000), expenseRow(1000)], allRows: [incomeRow(100000)] })
    await notifyAfterChange(prisma, USER_ID, { added: [expense(1000)] }, NOW)
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('pile au plafond : pas encore dépassé', async () => {
    const prisma = mockPrisma({ envelopeRows: [expenseRow(40000)], allRows: [incomeRow(100000)] })
    await notifyAfterChange(prisma, USER_ID, { added: [expense(40000)] }, NOW)
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('dépense datée d\'un autre mois : ne touche pas le mois courant, même déjà dépassé', async () => {
    // 420 € dépensés ce mois pour un plafond de 400 € : l'ancien calcul (après − montant) concluait
    // à tort à un franchissement.
    const prisma = mockPrisma({ envelopeRows: [expenseRow(42000)], allRows: [incomeRow(100000)] })

    await notifyAfterChange(prisma, USER_ID, { added: [expense(5000, LAST_MONTH)] }, NOW)

    expect(prisma.category.findMany).not.toHaveBeenCalled()
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('modification qui augmente le montant au-delà du plafond : notifie', async () => {
    // Plafond 400 € : 350 € avant (dont cette dépense à 50 €), passée à 150 € → 450 €.
    const prisma = mockPrisma({ envelopeRows: [expenseRow(30000), expenseRow(15000)], allRows: [incomeRow(100000)] })

    await notifyAfterChange(prisma, USER_ID, { removed: [expense(5000)], added: [expense(15000)] }, NOW)

    expect(createdTypes(prisma)).toEqual(['envelope_overspend'])
  })

  it('modification qui baisse le montant : ne cherche même pas l\'enveloppe', async () => {
    const prisma = mockPrisma({ envelopeRows: [expenseRow(45000)], allRows: [incomeRow(100000)] })
    await notifyAfterChange(prisma, USER_ID, { removed: [expense(15000)], added: [expense(5000)] }, NOW)
    expect(prisma.envelope.findFirst).not.toHaveBeenCalled()
  })

  it('suppression d\'une dépense : ne notifie jamais un dépassement', async () => {
    const prisma = mockPrisma({ envelopeRows: [expenseRow(45000)], allRows: [incomeRow(100000)] })
    await notifyAfterChange(prisma, USER_ID, { removed: [expense(5000)] }, NOW)
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('enveloppe d\'un autre utilisateur : filtrée par userId, ignorée', async () => {
    const prisma = mockPrisma({ allRows: [incomeRow(100000)] })
    prisma.envelope.findFirst.mockResolvedValue(null)

    await notifyAfterChange(prisma, USER_ID, { added: [expense(50000)] }, NOW)

    expect(prisma.envelope.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ENV_ID, userId: USER_ID } }))
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })
})

describe('notifyAfterChange — solde négatif', () => {
  it('une dépense fait passer le solde sous zéro : notifie', async () => {
    // Solde avant : 100 − 80 = 20 € ; après une dépense de 50 € : −30 €.
    const prisma = mockPrisma({ allRows: [incomeRow(10000), expenseRow(8000), expenseRow(5000)] })

    await notifyAfterChange(prisma, USER_ID, { added: [expense(5000, THIS_MONTH, null)] }, NOW)

    expect(prisma.notification.create).toHaveBeenCalledWith({ data: { userId: USER_ID, type: 'negative_balance' } })
  })

  it('solde déjà négatif avant : ne notifie pas à nouveau', async () => {
    const prisma = mockPrisma({ allRows: [incomeRow(1000), expenseRow(8000), expenseRow(5000)] })
    await notifyAfterChange(prisma, USER_ID, { added: [expense(5000, THIS_MONTH, null)] }, NOW)
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('le solde reste positif : pas de notification', async () => {
    const prisma = mockPrisma({ allRows: [incomeRow(100000), expenseRow(5000)] })
    await notifyAfterChange(prisma, USER_ID, { added: [expense(5000, THIS_MONTH, null)] }, NOW)
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('pile à zéro : pas encore négatif', async () => {
    const prisma = mockPrisma({ allRows: [incomeRow(5000), expenseRow(5000)] })
    await notifyAfterChange(prisma, USER_ID, { added: [expense(5000, THIS_MONTH, null)] }, NOW)
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('suppression d\'un revenu qui fait passer sous zéro : notifie', async () => {
    // Après suppression il ne reste que 30 € de dépenses : −30 € ; avant, +70 €.
    const prisma = mockPrisma({ allRows: [expenseRow(3000)] })

    await notifyAfterChange(prisma, USER_ID, { removed: [income(10000)] }, NOW)

    expect(createdTypes(prisma)).toEqual(['negative_balance'])
  })

  it('le solde augmente (revenu ajouté) : ne relit même pas les transactions', async () => {
    const prisma = mockPrisma()
    await notifyAfterChange(prisma, USER_ID, { added: [income(5000)] }, NOW)
    expect(prisma.transaction.findMany).not.toHaveBeenCalled()
  })

  it('compte les dépenses de tous les mois, pas seulement le mois courant', async () => {
    const prisma = mockPrisma({ allRows: [incomeRow(1000), expenseRow(5000)] })
    await notifyAfterChange(prisma, USER_ID, { added: [expense(5000, LAST_MONTH, null)] }, NOW)
    expect(createdTypes(prisma)).toEqual(['negative_balance'])
  })

  it('une même dépense peut déclencher les deux notifications', async () => {
    const prisma = mockPrisma({
      envelopeRows: [expenseRow(38000), expenseRow(5000)],
      allRows:      [incomeRow(40000), expenseRow(38000), expenseRow(5000)],
    })

    await notifyAfterChange(prisma, USER_ID, { added: [expense(5000)] }, NOW)

    expect(createdTypes(prisma)).toEqual(['negative_balance', 'envelope_overspend'])
  })
})

describe('notifyAfterChange — réglages du Profil', () => {
  it('solde négatif coupé : ne relit même pas les transactions', async () => {
    const prisma = mockPrisma({ allRows: [incomeRow(1000), expenseRow(5000)] })
    prisma.user.findUnique.mockResolvedValue({ notifyNegativeBalance: false, notifyEnvelopeOverspend: true })

    await notifyAfterChange(prisma, USER_ID, { added: [expense(5000, THIS_MONTH, null)] }, NOW)

    expect(prisma.transaction.findMany).not.toHaveBeenCalled()
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('enveloppe dépassée coupée : le solde négatif reste signalé', async () => {
    const prisma = mockPrisma({
      envelopeRows: [expenseRow(38000), expenseRow(5000)],
      allRows:      [incomeRow(40000), expenseRow(38000), expenseRow(5000)],
    })
    prisma.user.findUnique.mockResolvedValue({ notifyNegativeBalance: true, notifyEnvelopeOverspend: false })

    await notifyAfterChange(prisma, USER_ID, { added: [expense(5000)] }, NOW)

    expect(createdTypes(prisma)).toEqual(['negative_balance'])
    expect(prisma.category.findMany).not.toHaveBeenCalled()
  })

  it('utilisateur introuvable : ne fait rien', async () => {
    const prisma = mockPrisma({ allRows: [expenseRow(5000)] })
    prisma.user.findUnique.mockResolvedValue(null)

    await notifyAfterChange(prisma, USER_ID, { added: [expense(5000)] }, NOW)

    expect(prisma.notification.create).not.toHaveBeenCalled()
  })
})

describe('maybeCreateUncategorizedDigest', () => {
  it('rappel coupé dans le Profil : ne compte rien, ne crée rien', async () => {
    const prisma = mockPrisma()
    prisma.user.findUnique.mockResolvedValue({ lastUncategorizedDigestAt: null, notifyUncategorizedDigest: false })
    prisma.transaction.count.mockResolvedValue(9)

    await maybeCreateUncategorizedDigest(prisma, USER_ID, NOW)

    expect(prisma.transaction.count).not.toHaveBeenCalled()
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('aucune dépense non catégorisée : ne crée rien, ne réserve rien', async () => {
    const prisma = mockPrisma()
    prisma.transaction.count.mockResolvedValue(0)

    await maybeCreateUncategorizedDigest(prisma, USER_ID, NOW)

    expect(prisma.user.updateMany).not.toHaveBeenCalled()
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('des dépenses non catégorisées, jamais de digest avant : réserve la date puis en crée un', async () => {
    const prisma = mockPrisma()
    prisma.transaction.count.mockResolvedValue(18)

    await maybeCreateUncategorizedDigest(prisma, USER_ID, NOW)

    expect(prisma.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { lastUncategorizedDigestAt: NOW },
    }))
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, type: 'uncategorized_digest', count: 18 },
    })
  })

  it('dernier digest il y a moins d\'une semaine : n\'en crée pas un nouveau', async () => {
    const prisma = mockPrisma()
    prisma.user.findUnique.mockResolvedValue({ notifyUncategorizedDigest: true, lastUncategorizedDigestAt: new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000) })
    prisma.transaction.count.mockResolvedValue(18)

    await maybeCreateUncategorizedDigest(prisma, USER_ID, NOW)

    expect(prisma.notification.create).not.toHaveBeenCalled()
    expect(prisma.transaction.count).not.toHaveBeenCalled()
  })

  it('dernier digest il y a plus d\'une semaine : réévalue', async () => {
    const prisma = mockPrisma()
    prisma.user.findUnique.mockResolvedValue({ notifyUncategorizedDigest: true, lastUncategorizedDigestAt: new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000) })
    prisma.transaction.count.mockResolvedValue(3)

    await maybeCreateUncategorizedDigest(prisma, USER_ID, NOW)

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, type: 'uncategorized_digest', count: 3 },
    })
  })

  it('ne dépend pas des notifications existantes : supprimer le digest ne le fait pas revenir', async () => {
    // La date vit sur l'utilisateur — la notification elle-même n'est jamais relue.
    const prisma = mockPrisma()
    prisma.user.findUnique.mockResolvedValue({ notifyUncategorizedDigest: true, lastUncategorizedDigestAt: new Date(NOW.getTime() - 60 * 60 * 1000) })
    prisma.transaction.count.mockResolvedValue(5)

    await maybeCreateUncategorizedDigest(prisma, USER_ID, NOW)

    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('une requête concurrente a déjà réservé la date : n\'en crée pas un second', async () => {
    const prisma = mockPrisma()
    prisma.transaction.count.mockResolvedValue(5)
    prisma.user.updateMany.mockResolvedValue({ count: 0 })

    await maybeCreateUncategorizedDigest(prisma, USER_ID, NOW)

    expect(prisma.notification.create).not.toHaveBeenCalled()
  })
})
