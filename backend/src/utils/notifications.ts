/**
 * Génération des notifications.
 *
 * Trois types, tous évalués « à la demande » (au fil des requêtes) plutôt que par une tâche
 * planifiée — comme le rattrapage des charges fixes (voir utils/recurring.ts), l'app n'a pas
 * d'infrastructure de cron :
 *
 * - `envelope_overspend` et `negative_balance` : réactifs, vérifiés par `notifyAfterChange` après
 *   chaque écriture de transactions (création, modification, suppression, rattrapage des charges
 *   fixes). Ne se déclenchent qu'au moment où le seuil est FRANCHI par cette écriture (pas à chaque
 *   transaction déjà au-delà), pour ne pas spammer. Le « avant » est déduit de l'« après » moins
 *   la contribution de l'écriture : pas d'état à mémoriser, et supprimer la notification ne la fait
 *   pas réapparaître.
 * - `uncategorized_digest` : paresseux, vérifié à chaque appel de /api/notifications ou
 *   /api/notifications/unread-count — au plus une fois par semaine (voir DIGEST_INTERVAL_MS).
 *
 * Chaque type peut être coupé depuis le Profil (colonnes `notify*` de User) : un type coupé n'est
 * pas évalué du tout — ni calcul, ni notification.
 */

import type { PrismaClient } from '@prisma/client'
import { decryptValue } from './crypto.js'

const AMOUNT_USAGE = 'transaction-amount'
const BUDGET_USAGE = 'envelope-budget'

const DIGEST_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

/** Ce qui compte d'une transaction pour les seuils : montant (centimes), type, date, catégorie. */
export interface TransactionImpact {
  categoryId: string | null
  amount:     number
  date:       Date
  type:       string
}

interface Change {
  added?:   TransactionImpact[]
  removed?: TransactionImpact[]
}

/** Bornes du mois courant (UTC), comme dans GET /api/summary. */
function currentMonthRange(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const end   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
  return { start, end }
}

const decryptAmount = (row: { amountEncrypted: string }) => parseInt(decryptValue(row.amountEncrypted, AMOUNT_USAGE), 10)

/**
 * À appeler après toute écriture de transactions : `added` pour ce qui existe désormais, `removed`
 * pour ce qui n'existe plus (une modification = l'ancienne version retirée + la nouvelle ajoutée).
 */
export async function notifyAfterChange(prisma: PrismaClient, userId: string, change: Change, now: Date = new Date()) {
  const added   = change.added   ?? []
  const removed = change.removed ?? []

  const settings = await prisma.user.findUnique({
    where:  { id: userId },
    select: { notifyNegativeBalance: true, notifyEnvelopeOverspend: true },
  })
  if (!settings) return

  if (settings.notifyNegativeBalance)   await checkNegativeBalance(prisma, userId, added, removed)
  if (settings.notifyEnvelopeOverspend) await checkEnvelopeOverspend(prisma, userId, added, removed, now)
}

/**
 * Solde global (revenus − dépenses, toutes dates, comme GET /api/summary) : notifie
 * `negative_balance` si l'écriture le fait passer de ≥ 0 à < 0.
 */
async function checkNegativeBalance(prisma: PrismaClient, userId: string, added: TransactionImpact[], removed: TransactionImpact[]) {
  const signed = (t: TransactionImpact) => (t.type === 'income' ? t.amount : -t.amount)
  const delta = added.reduce((sum, t) => sum + signed(t), 0) - removed.reduce((sum, t) => sum + signed(t), 0)
  if (delta >= 0) return // le solde n'a pas baissé : rien ne peut avoir franchi zéro vers le bas

  const rows = await prisma.transaction.findMany({
    where:  { userId },
    select: { amountEncrypted: true, type: true },
  })

  const balanceAfter  = rows.reduce((sum, row) => sum + (row.type === 'income' ? 1 : -1) * decryptAmount(row), 0)
  const balanceBefore = balanceAfter - delta

  if (balanceBefore >= 0 && balanceAfter < 0) {
    await prisma.notification.create({ data: { userId, type: 'negative_balance' } })
  }
}

/**
 * Enveloppes (plafond mensuel, mois courant) : notifie `envelope_overspend` pour chaque enveloppe
 * que l'écriture fait passer de ≤ plafond à > plafond. Seules les dépenses catégorisées datées du
 * mois courant comptent — une dépense saisie sur un autre mois ne touche pas le mois en cours.
 */
async function checkEnvelopeOverspend(
  prisma: PrismaClient, userId: string, added: TransactionImpact[], removed: TransactionImpact[], now: Date,
) {
  const { start, end } = currentMonthRange(now)
  const counts = (t: TransactionImpact) =>
    t.type === 'expense' && t.categoryId !== null && t.date >= start && t.date <= end

  const relevant = [
    ...added.filter(counts).map((t) => ({ categoryId: t.categoryId as string, amount: t.amount })),
    ...removed.filter(counts).map((t) => ({ categoryId: t.categoryId as string, amount: -t.amount })),
  ]
  if (relevant.length === 0) return

  const categories = await prisma.category.findMany({
    where:  { userId, id: { in: [...new Set(relevant.map((t) => t.categoryId))] } },
    select: { id: true, envelopeId: true },
  })
  const envelopeOf = new Map(categories.map((c) => [c.id, c.envelopeId]))

  const deltas = new Map<string, number>()
  for (const { categoryId, amount } of relevant) {
    const envelopeId = envelopeOf.get(categoryId)
    if (envelopeId) deltas.set(envelopeId, (deltas.get(envelopeId) ?? 0) + amount)
  }

  for (const [envelopeId, delta] of deltas) {
    if (delta <= 0) continue // les dépenses de l'enveloppe n'ont pas augmenté

    const envelope = await prisma.envelope.findFirst({
      where:  { id: envelopeId, userId },
      select: { budgetEncrypted: true, categories: { select: { id: true } } },
    })
    if (!envelope) continue

    const budget = parseInt(decryptValue(envelope.budgetEncrypted, BUDGET_USAGE), 10)

    const rows = await prisma.transaction.findMany({
      where: {
        userId,
        type:       'expense',
        categoryId: { in: envelope.categories.map((c) => c.id) },
        date:       { gte: start, lte: end },
      },
      select: { amountEncrypted: true },
    })

    const spentAfter  = rows.reduce((sum, row) => sum + decryptAmount(row), 0)
    const spentBefore = spentAfter - delta

    if (spentBefore <= budget && spentAfter > budget) {
      await prisma.notification.create({ data: { userId, type: 'envelope_overspend', envelopeId } })
    }
  }
}

/**
 * À appeler à chaque lecture des notifications. Ne crée un digest que si le précédent date de
 * plus d'une semaine ET qu'il reste au moins une dépense non catégorisée à signaler.
 *
 * La date du dernier digest vit sur l'utilisateur (`lastUncategorizedDigestAt`), pas dans la
 * notification : supprimer le digest ne doit pas en faire recréer un aussitôt. Et elle est
 * réservée par une mise à jour conditionnelle (atomique) avant de créer : deux lectures
 * simultanées — la cloche et la page, au chargement de /notifications — n'en créent qu'un.
 */
export async function maybeCreateUncategorizedDigest(prisma: PrismaClient, userId: string, now: Date = new Date()) {
  const threshold = new Date(now.getTime() - DIGEST_INTERVAL_MS)

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { lastUncategorizedDigestAt: true, notifyUncategorizedDigest: true },
  })
  if (!user || !user.notifyUncategorizedDigest) return
  if (user.lastUncategorizedDigestAt && user.lastUncategorizedDigestAt >= threshold) return

  const count = await prisma.transaction.count({
    where: { userId, type: 'expense', categoryId: null },
  })
  if (count === 0) return

  const { count: claimed } = await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [{ lastUncategorizedDigestAt: null }, { lastUncategorizedDigestAt: { lt: threshold } }],
    },
    data: { lastUncategorizedDigestAt: now },
  })
  if (claimed === 0) return // une requête concurrente vient de le créer

  await prisma.notification.create({
    data: { userId, type: 'uncategorized_digest', count },
  })
}
