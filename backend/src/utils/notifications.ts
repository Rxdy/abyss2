/**
 * Génération des notifications.
 *
 * Deux types, tous deux évalués « à la demande » (au fil des requêtes) plutôt que par une tâche
 * planifiée — comme le rattrapage des charges fixes (voir utils/recurring.ts), l'app n'a pas
 * d'infrastructure de cron :
 *
 * - `envelope_overspend` : réactif, vérifié juste après la création d'une transaction. Ne se
 *   déclenche qu'au moment où l'enveloppe FRANCHIT son plafond (pas à chaque transaction déjà
 *   au-dessus), pour ne pas spammer.
 * - `uncategorized_digest` : paresseux, vérifié à chaque appel de /api/notifications ou
 *   /api/notifications/unread-count — au plus une fois par semaine (voir DIGEST_INTERVAL_MS).
 */

import type { PrismaClient } from '@prisma/client'
import { decryptValue } from './crypto.js'

const AMOUNT_USAGE = 'transaction-amount'
const BUDGET_USAGE = 'envelope-budget'

const DIGEST_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

/** Bornes du mois courant (UTC), comme dans GET /api/summary. */
function currentMonthRange() {
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
  return { start, end }
}

/**
 * À appeler après la création d'une transaction de dépense. Si sa catégorie appartient à une
 * enveloppe et que cette dépense fait franchir le plafond (pas déjà dépassé avant elle), crée une
 * notification `envelope_overspend`.
 */
export async function checkEnvelopeOverspend(
  prisma: PrismaClient, userId: string, categoryId: string | null, amount: number,
) {
  if (!categoryId) return

  const category = await prisma.category.findUnique({
    where:  { id: categoryId },
    select: { envelopeId: true },
  })
  if (!category?.envelopeId) return

  const envelope = await prisma.envelope.findUnique({
    where:  { id: category.envelopeId },
    select: { budgetEncrypted: true },
  })
  if (!envelope) return

  const budget = parseInt(decryptValue(envelope.budgetEncrypted, BUDGET_USAGE), 10)

  const linked = await prisma.category.findMany({
    where:  { userId, envelopeId: category.envelopeId },
    select: { id: true },
  })
  const linkedIds = linked.map((c) => c.id)

  const { start, end } = currentMonthRange()
  const rows = await prisma.transaction.findMany({
    where:  { userId, type: 'expense', categoryId: { in: linkedIds }, date: { gte: start, lte: end } },
    select: { amountEncrypted: true },
  })

  const spentAfter  = rows.reduce((sum, row) => sum + parseInt(decryptValue(row.amountEncrypted, AMOUNT_USAGE), 10), 0)
  const spentBefore = spentAfter - amount

  if (spentBefore <= budget && spentAfter > budget) {
    await prisma.notification.create({
      data: { userId, type: 'envelope_overspend', envelopeId: category.envelopeId },
    })
  }
}

/**
 * À appeler à chaque lecture des notifications. Ne crée un digest que si le précédent date de
 * plus d'une semaine ET qu'il reste au moins une dépense non catégorisée à signaler.
 */
export async function maybeCreateUncategorizedDigest(prisma: PrismaClient, userId: string) {
  const last = await prisma.notification.findFirst({
    where:   { userId, type: 'uncategorized_digest' },
    orderBy: { createdAt: 'desc' },
    select:  { createdAt: true },
  })
  if (last && Date.now() - last.createdAt.getTime() < DIGEST_INTERVAL_MS) return

  const count = await prisma.transaction.count({
    where: { userId, type: 'expense', categoryId: null },
  })
  if (count === 0) return

  await prisma.notification.create({
    data: { userId, type: 'uncategorized_digest', count },
  })
}
