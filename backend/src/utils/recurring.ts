/**
 * Génération des transactions issues des charges fixes (dépenses/revenus
 * récurrents mensuels).
 *
 * Principe : chaque RecurringTransaction mémorise `lastGeneratedMonth`
 * ('YYYY-MM'). À chaque appel de `runDueRecurring`, on rattrape tous les
 * mois écoulés entre ce marqueur (exclu) et le mois courant (inclus, si le
 * jour d'échéance est déjà passé) en créant une Transaction normale par
 * mois dû, puis on avance le marqueur. Les dates sont manipulées en UTC
 * pur (les colonnes sont des DATE, sans heure ni fuseau) pour ne jamais
 * dépendre du fuseau du serveur.
 */

import type { PrismaClient } from '@prisma/client'

/** Sécurité anti-boucle infinie si des dates aberrantes se glissaient quelque part. */
const MAX_CATCHUP_MONTHS = 240 // 20 ans

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/** Date UTC → 'YYYY-MM'. */
export function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`
}

/** 'YYYY-MM' → { year, month0 } (month0 = mois 0-indexé, pour Date.UTC). */
function parseMonthKey(key: string) {
  const [year, month] = key.split('-').map(Number)
  return { year, month0: month - 1 }
}

/** 'YYYY-MM' + n → 'YYYY-MM' (n peut être négatif). */
export function addMonthKey(key: string, delta: number) {
  const { year, month0 } = parseMonthKey(key)
  const total = year * 12 + month0 + delta
  return `${Math.floor(total / 12)}-${pad2((total % 12 + 12) % 12 + 1)}`
}

/** Compare deux clés 'YYYY-MM' (-1, 0, 1). */
export function compareMonthKey(a: string, b: string) {
  return a === b ? 0 : a < b ? -1 : 1
}

function daysInMonth(year: number, month0: number) {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
}

/** Date (minuit UTC) d'un jour-du-mois donné pour une clé 'YYYY-MM', ramenée au dernier jour du mois si besoin (ex: 31 février → 28/29). */
export function occurrenceDate(key: string, dayOfMonth: number) {
  const { year, month0 } = parseMonthKey(key)
  const day = Math.min(dayOfMonth, daysInMonth(year, month0))
  return new Date(Date.UTC(year, month0, day))
}

/** Normalise une Date quelconque à minuit UTC (pour comparer avec des colonnes DATE). */
function toUTCDateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

/**
 * Liste les mois ('YYYY-MM') pour lesquels une transaction doit être
 * générée, entre `lastGeneratedMonth` (exclu) ou `startDate` (inclus) et
 * `now` (inclus, seulement si le jour d'échéance de ce mois est déjà passé).
 */
export function dueMonths(recurring: {
  dayOfMonth: number
  startDate: Date | string
  endDate?: Date | string | null
  lastGeneratedMonth?: string | null
}, now: Date = new Date()): string[] {
  const start = toUTCDateOnly(new Date(recurring.startDate))
  const end   = recurring.endDate ? toUTCDateOnly(new Date(recurring.endDate)) : null
  const today = toUTCDateOnly(now)

  const startMonth   = monthKey(start)
  const currentMonth = monthKey(today)
  let cursor = recurring.lastGeneratedMonth
    ? addMonthKey(recurring.lastGeneratedMonth, 1)
    : startMonth

  if (compareMonthKey(cursor, startMonth) < 0) cursor = startMonth

  const months: string[] = []

  for (let i = 0; i < MAX_CATCHUP_MONTHS && compareMonthKey(cursor, currentMonth) <= 0; i++) {
    const occurrence = occurrenceDate(cursor, recurring.dayOfMonth)

    const beforeStart  = occurrence.getTime() < start.getTime()
    const afterEnd     = end ? occurrence.getTime() > end.getTime() : false
    const isCurrentMonth = cursor === currentMonth
    const notDueYet    = isCurrentMonth && occurrence.getTime() > today.getTime()

    if (!beforeStart && !afterEnd && !notDueYet) months.push(cursor)

    cursor = addMonthKey(cursor, 1)
  }

  return months
}

/**
 * Prochaine échéance à venir (>= aujourd'hui), ou `null` si la charge fixe
 * est déjà terminée (endDate dépassée). Sert uniquement à l'affichage.
 */
export function nextOccurrenceDate(recurring: {
  dayOfMonth: number
  startDate: Date | string
  endDate?: Date | string | null
}, now: Date = new Date()) {
  const start = toUTCDateOnly(new Date(recurring.startDate))
  const end   = recurring.endDate ? toUTCDateOnly(new Date(recurring.endDate)) : null
  const today = toUTCDateOnly(now)

  let cursor = monthKey(today.getTime() < start.getTime() ? start : today)
  let candidate = occurrenceDate(cursor, recurring.dayOfMonth)

  const floor = today.getTime() > start.getTime() ? today : start
  if (candidate.getTime() < floor.getTime()) {
    cursor = addMonthKey(cursor, 1)
    candidate = occurrenceDate(cursor, recurring.dayOfMonth)
  }

  if (end && candidate.getTime() > end.getTime()) return null
  return candidate
}

/**
 * Génère, pour un utilisateur donné, toutes les transactions dues depuis
 * la dernière génération de chacune de ses charges fixes actives, et renvoie
 * le nombre de transactions créées.
 *
 * Le rattrapage tourne à chaque lecture : deux requêtes simultanées peuvent
 * calculer les mêmes échéances. L'unicité (charge fixe, date) est garantie par
 * un index unique en base ; `skipDuplicates` (INSERT … ON CONFLICT DO NOTHING)
 * fait que la seconde requête saute simplement ce qui existe déjà, sans faire
 * échouer — ni annuler — sa transaction.
 */
export async function runDueRecurring(prisma: PrismaClient, userId: string, { now = new Date() }: { now?: Date } = {}) {
  const recurringList = await prisma.recurringTransaction.findMany({
    where: { userId, active: true },
  })

  let created = 0

  for (const recurring of recurringList) {
    const months = dueMonths(recurring, now)
    if (months.length === 0) continue

    await prisma.$transaction(async (tx) => {
      // Le libellé et le montant sont déjà chiffrés sur le modèle récurrent
      // (même clé/usage que les transactions) : on recopie le ciphertext
      // tel quel, pas besoin de déchiffrer/re-chiffrer.
      const { count } = await tx.transaction.createMany({
        data: months.map((month) => ({
          userId,
          categoryId:      recurring.categoryId,
          recurringId:     recurring.id,
          titleEncrypted:  recurring.titleEncrypted,
          amountEncrypted: recurring.amountEncrypted,
          date:            occurrenceDate(month, recurring.dayOfMonth),
          type:            recurring.type,
          note:            recurring.note,
        })),
        skipDuplicates: true,
      })
      created += count

      await tx.recurringTransaction.update({
        where: { id: recurring.id },
        data:  { lastGeneratedMonth: months[months.length - 1] },
      })
    })
  }

  return created
}
