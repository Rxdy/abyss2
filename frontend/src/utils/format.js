/**
 * Formatage — les montants circulent en **centimes** (entiers) dans toute
 * l'app ; ils ne sont convertis dans la devise du compte qu'à l'affichage.
 */
import { ref } from 'vue'

/** Devises proposées (page Préférences) — même liste que l'API (utils/currency.ts). */
export const CURRENCIES = [
  { code: 'EUR', label: 'Euro' },
  { code: 'USD', label: 'Dollar américain' },
  { code: 'GBP', label: 'Livre sterling' },
  { code: 'CHF', label: 'Franc suisse' },
  { code: 'CAD', label: 'Dollar canadien' },
]

/**
 * Devise courante — une ref : tout composant qui affiche un montant se ré-affiche quand elle
 * change, sans rechargement. Posée par la session (auth.store) et par la page Préférences.
 */
const currentCurrency = ref('EUR')
const formatters = new Map()

function moneyFormat() {
  const code = currentCurrency.value
  if (!formatters.has(code)) formatters.set(code, new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code }))
  return formatters.get(code)
}

/** Change la devise d'affichage ; une valeur inconnue retombe sur l'euro. */
export function setCurrency(code) {
  currentCurrency.value = CURRENCIES.some((c) => c.code === code) ? code : 'EUR'
}

export function getCurrency() {
  return currentCurrency.value
}

/** Symbole de la devise courante (« € », « $US », « £ »…), pour les libellés de saisie. */
export function currencySymbol() {
  return moneyFormat().formatToParts(0).find((part) => part.type === 'currency')?.value ?? currentCurrency.value
}

const longDate  = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' })
const shortDate = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })

/** 4250 → "42,50 €" (dans la devise du compte) */
export function formatAmount(cents) {
  return moneyFormat().format((Number(cents) || 0) / 100)
}

/** Montant signé selon le type : dépense en négatif, revenu en positif. */
export function formatSignedAmount(cents, type) {
  const value = (Number(cents) || 0) / 100
  return moneyFormat().format(type === 'expense' ? -value : value)
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

/**
 * Date du jour (fuseau de l'appareil) au format attendu par l'API et les
 * <input type="date">. Pas de toISOString() : il donne la date UTC, donc la
 * veille entre minuit et 1 h/2 h en France.
 */
export function todayISO(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA').format(now) // en-CA → yyyy-mm-dd
}
