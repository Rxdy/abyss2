/**
 * Formatage — les montants circulent en **centimes** (entiers) dans toute
 * l'app ; ils ne sont convertis en euros qu'à l'affichage.
 */

const currency = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
})

const longDate  = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' })
const shortDate = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' })

/** 4250 → "42,50 €" */
export function formatAmount(cents) {
  return currency.format((Number(cents) || 0) / 100)
}

/** Montant signé selon le type : dépense en négatif, revenu en positif. */
export function formatSignedAmount(cents, type) {
  const value = (Number(cents) || 0) / 100
  return currency.format(type === 'expense' ? -value : value)
}

/** "2026-09-05" → "5 septembre 2026" */
export function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : longDate.format(date)
}

/** "2026-09-05" → "05 sept." */
export function formatShortDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : shortDate.format(date)
}

/** "2026-09" → "septembre 2026" */
export function formatMonth(monthKey) {
  const [year, month] = String(monthKey ?? '').split('-')
  if (!year || !month) return '—'
  return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })
    .format(new Date(Number(year), Number(month) - 1, 1))
}

/** Saisie utilisateur ("12,50" ou "12.5") → centimes (1250). */
export function parseAmountToCents(input) {
  const normalized = String(input ?? '').replace(',', '.').trim()
  if (!normalized) return null

  const value = Number(normalized)
  if (!Number.isFinite(value) || value <= 0) return null

  return Math.round(value * 100)
}

/** Date du jour au format attendu par l'API et les <input type="date">. */
export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
