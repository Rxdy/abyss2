/**
 * Devise d'affichage choisie par l'utilisateur (page Préférences). Les montants restent stockés en
 * centimes, sans devise : celle-ci ne change que leur présentation. Liste limitée à des devises à
 * deux décimales, pour que « centimes » garde son sens. Même liste dans la contrainte
 * chk_users_currency (migration init) et côté front (utils/format.js).
 */
export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD'] as const

export type Currency = (typeof CURRENCIES)[number]

export const DEFAULT_CURRENCY: Currency = 'EUR'

const formatters = new Map<string, Intl.NumberFormat>()

/** 43210, 'EUR' → « 432,10 € » (une devise inconnue retombe sur l'euro). */
export function formatCents(cents: number, currency: string = DEFAULT_CURRENCY) {
  const code = (CURRENCIES as readonly string[]).includes(currency) ? currency : DEFAULT_CURRENCY
  let formatter = formatters.get(code)
  if (!formatter) {
    formatter = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: code })
    formatters.set(code, formatter)
  }
  return formatter.format(cents / 100)
}
