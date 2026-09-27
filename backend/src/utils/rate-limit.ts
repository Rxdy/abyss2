/**
 * Erreur 429 commune à toutes les limitations de débit : le gestionnaire d'erreurs
 * de l'app en fait `{ error, code: 'RATE_LIMITED' }`, comme les autres erreurs de l'API.
 */
export function rateLimitError(ttlMs: number, statusCode = 429) {
  const minutes = Math.max(1, Math.ceil(ttlMs / 60_000))
  return Object.assign(
    new Error(`Trop de tentatives — réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`),
    { statusCode, code: 'RATE_LIMITED' },
  )
}
