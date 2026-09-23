/**
 * Périodes de comparaison des statistiques : à quoi comparer la période
 * affichée, et comment lire l'écart.
 *
 * Toutes les dates sont des 'yyyy-mm-dd' manipulées en UTC (aucun décalage
 * de fuseau) ; `today` est la date locale de l'appareil, fournie par l'appelant.
 */

import { formatMonth } from '@/utils/format.js'

const DAY = 86_400_000

const toDate = (iso) => new Date(`${iso}T00:00:00Z`)
const toISO  = (date) => date.toISOString().slice(0, 10)
const addDays = (iso, days) => toISO(new Date(toDate(iso).getTime() + days * DAY))
const daysBetween = (from, to) => Math.round((toDate(to) - toDate(from)) / DAY)

/** Dernier jour du mois qui contient `iso`. */
const endOfMonth = (iso) => toISO(new Date(Date.UTC(toDate(iso).getUTCFullYear(), toDate(iso).getUTCMonth() + 1, 0)))

/** Même jour de l'année précédente (le 29 février retombe sur le 28). */
function sameDayLastYear(iso) {
  const date = toDate(iso)
  const year = date.getUTCFullYear() - 1
  const lastDay = new Date(Date.UTC(year, date.getUTCMonth() + 1, 0)).getUTCDate()
  return toISO(new Date(Date.UTC(year, date.getUTCMonth(), Math.min(date.getUTCDate(), lastDay))))
}

/**
 * La période à laquelle comparer [from, to].
 *
 * - mois : le mois précédent. Si le mois affiché est en cours, on ne compare
 *   qu'au même nombre de jours du mois précédent (comparer 21 jours à un mois
 *   entier n'aurait aucun sens) ;
 * - année : l'année précédente, avec la même règle pour l'année en cours ;
 * - personnalisé : la période de même durée juste avant.
 *
 * @returns {{ from: string, to: string, label: string }} `label` : « août 2026 », « au 21 août »…
 */
export function previousPeriod({ view, from, to, today }) {
  if (view === 'month') {
    const prevMonthEnd = addDays(from, -1)
    const prevMonthStart = `${prevMonthEnd.slice(0, 7)}-01`
    const inProgress = today >= from && today <= to

    if (!inProgress) {
      return { from: prevMonthStart, to: prevMonthEnd, label: formatMonth(prevMonthStart.slice(0, 7)) }
    }

    const elapsed = daysBetween(from, today) // jours écoulés dans le mois courant, aujourd'hui exclu
    const cutoff = addDays(prevMonthStart, elapsed)
    const end = cutoff > prevMonthEnd ? prevMonthEnd : cutoff
    return {
      from: prevMonthStart,
      to: end,
      label: `${formatMonth(prevMonthStart.slice(0, 7)).split(' ')[0]}, au ${Number(end.slice(8))}`,
    }
  }

  if (view === 'year') {
    const year = Number(from.slice(0, 4)) - 1
    const inProgress = today >= from && today <= to
    return {
      from: `${year}-01-01`,
      to: inProgress ? sameDayLastYear(today) : `${year}-12-31`,
      label: inProgress ? `${year}, à la même date` : String(year),
    }
  }

  const length = daysBetween(from, to) + 1
  const prevTo = addDays(from, -1)
  return { from: addDays(prevTo, -(length - 1)), to: prevTo, label: 'la période précédente' }
}

/**
 * L'écart entre deux totaux (en centimes).
 *
 * @returns {{ diff: number, percent: number | null, direction: 'up' | 'down' | 'flat', tone: 'good' | 'bad' | 'neutral' }}
 *   `percent` est null sans base de comparaison (période précédente à zéro) ;
 *   `tone` dit si l'évolution est favorable : pour une dépense, moins c'est mieux ; pour un revenu, plus.
 */
export function compareTotals(current, previous, type = 'expense') {
  const diff = current - previous
  const direction = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'
  const percent = previous > 0 ? Math.round((diff / previous) * 1000) / 10 : null

  let tone = 'neutral'
  if (direction !== 'flat') tone = (direction === 'up') === (type === 'income') ? 'good' : 'bad'

  return { diff, percent, direction, tone }
}

/** 'yyyy-mm' décalé de `delta` mois (négatif : vers le passé). */
export function shiftMonth(monthKey, delta) {
  const [year, month] = monthKey.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Premier et dernier jour d'un mois 'yyyy-mm' : { from: '2026-02-01', to: '2026-02-28' }. */
export function monthRange(monthKey) {
  const first = `${monthKey}-01`
  return { from: first, to: endOfMonth(first) }
}

