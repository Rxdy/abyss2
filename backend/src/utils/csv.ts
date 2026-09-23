/**
 * Sérialisation CSV (RFC 4180) pour l'export des données.
 *
 * Les libellés et notes viennent de l'utilisateur : une cellule qui commence
 * par `=`, `+`, `-`, `@`, tabulation ou retour chariot serait interprétée comme
 * une formule à l'ouverture dans Excel / LibreOffice (injection CSV). On la
 * préfixe d'une apostrophe, qui force l'affichage en texte.
 */

const FORMULA_START = /^[=+\-@\t\r]/

/** Une cellule prête à être écrite : neutralisée puis, si besoin, entre guillemets. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''

  let text = String(value)
  if (FORMULA_START.test(text)) text = `'${text}`

  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** En-tête + lignes, séparés par CRLF, précédés d'un BOM pour qu'Excel lise l'UTF-8. */
export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map(row => row.map(csvCell).join(','))
  return '﻿' + lines.join('\r\n') + '\r\n'
}

/** Centimes → « 12.34 » (point décimal, sans symbole ni séparateur de milliers). */
export function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2)
}
