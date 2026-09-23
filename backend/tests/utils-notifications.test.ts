/**
 * Tests — génération des notifications (utils/notifications.ts)
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'

beforeAll(() => {
  process.env.MASTER_SECRET = 'b'.repeat(64)
})

const { encryptValue } = await import('../src/utils/crypto.js')
const { checkEnvelopeOverspend, maybeCreateUncategorizedDigest } = await import('../src/utils/notifications.js')

const USER_ID = '11111111-1111-1111-1111-111111111111'
const CAT_ID  = '22222222-2222-2222-2222-222222222222'
const ENV_ID  = '55555555-5555-5555-5555-555555555555'

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    category: {
      findUnique: vi.fn().mockResolvedValue({ envelopeId: ENV_ID }),
      findMany:   vi.fn().mockResolvedValue([{ id: CAT_ID }]),
    },
    envelope: {
      findUnique: vi.fn().mockResolvedValue({ budgetEncrypted: encryptValue('40000', 'envelope-budget') }),
    },
    transaction: {
      findMany: vi.fn().mockResolvedValue([]),
      count:    vi.fn().mockResolvedValue(0),
    },
    notification: {
      create:    vi.fn(),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    ...overrides,
  } as any
}

const amountRow = (cents: number) => ({ amountEncrypted: encryptValue(String(cents), 'transaction-amount') })

describe('checkEnvelopeOverspend', () => {
  it('sans catégorie : ne fait rien', async () => {
    const prisma = mockPrisma()
    await checkEnvelopeOverspend(prisma, USER_ID, null, 5000)
    expect(prisma.category.findUnique).not.toHaveBeenCalled()
  })

  it('catégorie sans enveloppe : ne fait rien', async () => {
    const prisma = mockPrisma()
    prisma.category.findUnique.mockResolvedValue({ envelopeId: null })

    await checkEnvelopeOverspend(prisma, USER_ID, CAT_ID, 5000)

    expect(prisma.envelope.findUnique).not.toHaveBeenCalled()
    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('reste sous le plafond : pas de notification', async () => {
    const prisma = mockPrisma()
    prisma.transaction.findMany.mockResolvedValue([amountRow(10000)]) // total 100€ < 400€

    await checkEnvelopeOverspend(prisma, USER_ID, CAT_ID, 10000)

    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('franchit le plafond avec cette transaction : notifie', async () => {
    const prisma = mockPrisma()
    // Budget 400€ ; total après = 420€, la transaction de 50€ vient de faire franchir le seuil.
    prisma.transaction.findMany.mockResolvedValue([amountRow(37000), amountRow(5000)])

    await checkEnvelopeOverspend(prisma, USER_ID, CAT_ID, 5000)

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, type: 'envelope_overspend', envelopeId: ENV_ID },
    })
  })

  it('déjà au-dessus avant cette transaction : ne notifie pas à nouveau', async () => {
    const prisma = mockPrisma()
    // Déjà 410€ avant + 10€ maintenant = 420€ : était déjà au-dessus de 400€.
    prisma.transaction.findMany.mockResolvedValue([amountRow(41000), amountRow(1000)])

    await checkEnvelopeOverspend(prisma, USER_ID, CAT_ID, 1000)

    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('pile au plafond : pas encore dépassé', async () => {
    const prisma = mockPrisma()
    prisma.transaction.findMany.mockResolvedValue([amountRow(40000)])

    await checkEnvelopeOverspend(prisma, USER_ID, CAT_ID, 40000)

    expect(prisma.notification.create).not.toHaveBeenCalled()
  })
})

describe('maybeCreateUncategorizedDigest', () => {
  it('aucune dépense non catégorisée : ne crée rien', async () => {
    const prisma = mockPrisma()
    prisma.transaction.count.mockResolvedValue(0)

    await maybeCreateUncategorizedDigest(prisma, USER_ID)

    expect(prisma.notification.create).not.toHaveBeenCalled()
  })

  it('des dépenses non catégorisées, jamais de digest avant : en crée un', async () => {
    const prisma = mockPrisma()
    prisma.transaction.count.mockResolvedValue(18)

    await maybeCreateUncategorizedDigest(prisma, USER_ID)

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, type: 'uncategorized_digest', count: 18 },
    })
  })

  it('dernier digest il y a moins d\'une semaine : n\'en crée pas un nouveau', async () => {
    const prisma = mockPrisma()
    prisma.notification.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) })
    prisma.transaction.count.mockResolvedValue(18)

    await maybeCreateUncategorizedDigest(prisma, USER_ID)

    expect(prisma.notification.create).not.toHaveBeenCalled()
    expect(prisma.transaction.count).not.toHaveBeenCalled()
  })

  it('dernier digest il y a plus d\'une semaine : réévalue', async () => {
    const prisma = mockPrisma()
    prisma.notification.findFirst.mockResolvedValue({ createdAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) })
    prisma.transaction.count.mockResolvedValue(3)

    await maybeCreateUncategorizedDigest(prisma, USER_ID)

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, type: 'uncategorized_digest', count: 3 },
    })
  })
})
