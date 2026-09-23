/**
 * Session : jeton JWT porté par un cookie httpOnly, plus le jeton CSRF qui l'accompagne.
 *
 * Le cookie n'est jamais lisible en JavaScript (httpOnly) — un script injecté ne peut plus le
 * voler, contrairement au `sessionStorage` d'avant. Comme les requêtes « simples » (navigation,
 * formulaire) envoient les cookies sans que JavaScript s'en mêle, chaque route qui modifie des
 * données exige en plus un jeton CSRF (`fastify.csrfIfCookie`, voir app.ts) : un site tiers qui
 * ferait cliquer la victime ne connaît pas ce jeton et ne peut pas le fournir.
 *
 * `fastify.authenticate` (voir app.ts) accepte aussi bien ce cookie qu'un `Authorization: Bearer`
 * classique — utile pour les tests et un futur client non-navigateur — mais seul le cookie déclenche
 * la vérification CSRF : un script qui doit connaître un jeton Bearer à l'avance n'est de toute façon
 * pas exposé à la contrefaçon de requête intersite.
 */

import type { FastifyInstance, FastifyReply } from 'fastify'

export const SESSION_COOKIE = 'token'
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 // 7 jours, en secondes — cookie ET expiration du JWT

export function sessionCookieOptions() {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    // Un navigateur refuse un cookie `Secure` sur http:// non chiffré (dev, localhost) : n'exiger
    // HTTPS qu'en production, où Traefik le termine (voir docker-compose.prod.yml).
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE,
  }
}

/**
 * Ouvre une session pour `user` : signe le JWT, le pose en cookie httpOnly, et fournit le jeton
 * CSRF associé (à renvoyer par le client dans le corps de la réponse, jamais dans un cookie lisible).
 */
export function issueSession(
  fastify: FastifyInstance,
  reply: FastifyReply,
  user: { id: string; email: string; tokenVersion: number },
) {
  const token = fastify.jwt.sign(
    { userId: user.id, email: user.email, tv: user.tokenVersion },
    { expiresIn: SESSION_MAX_AGE },
  )
  reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions())

  return { csrfToken: reply.generateCsrf() }
}

/** Referme la session : efface le cookie. N'exige pas de session valide — appelable à tout moment. */
export function clearSession(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, { path: '/' })
}
