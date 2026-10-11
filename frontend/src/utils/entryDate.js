/**
 * Date la plus ancienne qu'on peut saisir : le 1er du mois de création du compte (`earliestDate`,
 * fourni par l'API). Le même contrôle est fait côté serveur ; ici, il sert à borner le calendrier
 * et à prévenir avant l'envoi.
 */
import { formatMonth } from '@/utils/format.js'

/**
 * Borne du champ date. Une saisie déjà plus ancienne (compte démo, données d'avant la règle) garde
 * sa propre date comme borne : elle reste modifiable sans devoir la déplacer.
 */
export function minEntryDate(earliestDate, savedDate) {
  if (!earliestDate) return undefined
  return savedDate && savedDate < earliestDate ? savedDate : earliestDate
}

/** Message d'erreur quand la date choisie tombe avant le mois de création du compte. */
export function tooEarlyMessage(earliestDate) {
  return `Pas de date avant le 1er ${formatMonth(earliestDate.slice(0, 7))} : votre compte démarre ce mois-là.`
}
