/**
 * « Aujourd'hui » et « mois courant » tels que l'utilisateur les vit.
 *
 * Le serveur tourne en UTC : entre minuit et 1 h/2 h à Paris, la date UTC est
 * encore celle de la veille, et le solde du mois basculait avec du retard.
 * Fuseau surchargeable avec APP_TIMEZONE.
 */

const DEFAULT_TIMEZONE = 'Europe/Paris'

/** yyyy-mm-dd du jour `now` dans le fuseau de l'application. */
export function todayISO(now: Date = new Date(), timeZone = process.env.APP_TIMEZONE ?? DEFAULT_TIMEZONE): string {
  // La locale en-CA formate en yyyy-mm-dd.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)
}

/** yyyy-mm du mois courant dans le fuseau de l'application. */
export function currentMonthKey(now: Date = new Date(), timeZone?: string): string {
  return todayISO(now, timeZone).slice(0, 7)
}
