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

/**
 * Deux façons de garder une session, au choix de l'utilisateur (page Préférences, colonne
 * `users.session_mode`) — c'est le serveur qui décide du cookie, le réglage ne se contourne pas
 * côté navigateur :
 *
 * - `persistent` (« Rester connecté ») : cookie persistant de 30 jours, **glissant** — renouvelé
 *   tant que l'app sert, donc jamais d'expiration en cours d'usage ; seule une absence de 30 jours
 *   impose de se reconnecter.
 * - `strict` (« Connexion à chaque session ») : cookie de session (sans date d'expiration : le
 *   navigateur l'efface à sa fermeture) et jeton de 30 minutes, lui aussi glissant — 30 minutes
 *   d'inactivité suffisent à fermer la session.
 *
 * Le glissement ne ré-émet que le cookie du JWT, jamais le jeton CSRF (qui vit en mémoire côté
 * front et doit rester valable).
 */
export const SESSION_MODES = ['persistent', 'strict'] as const
export type SessionMode = (typeof SESSION_MODES)[number]

const SESSION_POLICIES: Record<SessionMode, { lifetime: number; persistentCookie: boolean }> = {
  persistent: { lifetime: 30 * 24 * 60 * 60, persistentCookie: true },  // secondes
  strict:     { lifetime: 30 * 60,           persistentCookie: false },
}

function policyOf(mode: string | null | undefined) {
  return SESSION_POLICIES[(SESSION_MODES as readonly string[]).includes(mode ?? '') ? mode as SessionMode : 'persistent']
}

export function sessionCookieOptions(mode: string = 'persistent') {
  const policy = policyOf(mode)
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax' as const,
    // Un navigateur refuse un cookie `Secure` sur http:// non chiffré (dev, localhost) : n'exiger
    // HTTPS qu'en production, où Traefik le termine (voir docker-compose.prod.yml).
    secure: process.env.NODE_ENV === 'production',
    // Sans maxAge, c'est un cookie de session : effacé à la fermeture du navigateur.
    ...(policy.persistentCookie && { maxAge: policy.lifetime }),
  }
}

interface SessionUser { id: string; email: string; tokenVersion: number; sessionMode?: string | null }

/** Signe le JWT et le pose en cookie httpOnly, selon le mode de session du compte. */
export function setSessionCookie(fastify: FastifyInstance, reply: FastifyReply, user: SessionUser) {
  const mode = user.sessionMode ?? 'persistent'
  const token = fastify.jwt.sign(
    { userId: user.id, email: user.email, tv: user.tokenVersion },
    { expiresIn: policyOf(mode).lifetime },
  )
  reply.setCookie(SESSION_COOKIE, token, sessionCookieOptions(mode))
}

/**
 * Ouvre une session pour `user` : pose le cookie, et fournit le jeton CSRF associé (à renvoyer
 * par le client dans le corps de la réponse, jamais dans un cookie lisible).
 */
export function issueSession(fastify: FastifyInstance, reply: FastifyReply, user: SessionUser) {
  setSessionCookie(fastify, reply, user)
  return { csrfToken: reply.generateCsrf() }
}

/**
 * Renouvellement glissant : un jeton qui a déjà vécu plus d'un sixième de sa durée est ré-émis à
 * pleine durée (au plus toutes les 5 minutes en mode strict, une fois par jour environ sinon —
 * pas à chaque requête).
 */
export function shouldRenew(issuedAt: number | undefined, mode: string | null | undefined, now = Date.now()) {
  if (issuedAt === undefined) return false
  return now / 1000 - issuedAt > policyOf(mode).lifetime / 6
}

/** Referme la session : efface le cookie. N'exige pas de session valide — appelable à tout moment. */
export function clearSession(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, { path: '/' })
}
