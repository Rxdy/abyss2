/**
 * Tests d'intégration — session par cookie httpOnly + protection CSRF.
 *
 * Le jeton de session ne voyage plus que dans un cookie httpOnly (illisible en JavaScript) ;
 * un `Authorization: Bearer` classique reste accepté (tests, outillage), et c'est justement ce
 * qui distingue les deux : seule une requête authentifiée PAR LE COOKIE — c'est-à-dire portée
 * automatiquement par le navigateur, sans que le code JS du site appelant ait eu besoin de la
 * connaître — doit présenter un jeton CSRF pour modifier des données.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { buildApp } from '../src/app.js'

beforeAll(() => {
  process.env.MASTER_SECRET = 'b'.repeat(64)
  process.env.JWT_SECRET    = 'test-jwt-secret'
})

const { encryptEmail } = await import('../src/utils/crypto.js')

const USER_ID = '11111111-1111-1111-1111-111111111111'
const STRONG_PASSWORD = 'Tirelire_Abyss-99'

let app: any
let mockPrisma: any

beforeEach(async () => {
  mockPrisma = {
    user: { findUnique: vi.fn(), create: vi.fn() },
    category: {
      findMany: vi.fn().mockResolvedValue([]),
      count:    vi.fn().mockResolvedValue(0),
      create:   vi.fn().mockImplementation(async ({ data }: any) => ({ id: 'cat-1', ...data, _count: { transactions: 0, children: 0 } })),
    },
    $disconnect: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([]),
  }
  // Valeur par défaut PERSISTANTE (pas `...Once`) : une requête authentifiée par cookie déclenche
  // *plusieurs* appels à `findUnique` — celui du handler de login, puis celui de `authenticate`
  // (vérification du tokenVersion), puis souvent celui du handler de la route elle-même. Un même
  // enregistrement cohérent, cumulant tous les champs dont chacun a besoin, sert les trois sans
  // avoir à empiler des `mockResolvedValueOnce` dans le bon ordre (fragile : `authenticate`
  // consommerait alors la valeur destinée à un autre appel).
  mockPrisma.user.findUnique.mockResolvedValue({
    id: USER_ID, tokenVersion: 0,
    emailEncrypted: encryptEmail('alice@example.com'),
    createdAt: new Date(),
    passwordHash: await (await import('bcryptjs')).default.hash(STRONG_PASSWORD, 4),
  })
  app = await buildApp({ testing: true, prisma: mockPrisma })
  await app.ready()
})

afterEach(async () => {
  if (app) await app.close()
})

/** Connexion réussie : renvoie le cookie de session et le jeton CSRF, comme un vrai navigateur les obtiendrait. */
async function login() {
  const res = await app.inject({
    method: 'POST', url: '/api/auth/login',
    payload: { email: 'alice@example.com', password: STRONG_PASSWORD },
  })
  const cookies = res.cookies.map((c: any) => `${c.name}=${c.value}`).join('; ')
  return { cookies, csrfToken: res.json().csrfToken }
}

const createCategory = (headers: Record<string, string>) =>
  app.inject({ method: 'POST', url: '/api/categories', headers, payload: { name: 'Loisirs' } })

describe('authentification par cookie', () => {
  it('le cookie de session suffit, sans en-tête Authorization', async () => {
    const { cookies } = await login()

    const res = await app.inject({ method: 'GET', url: '/api/user', headers: { cookie: cookies } })

    expect(res.statusCode).toBe(200)
  })

  it('sans cookie ni en-tête : 401, comme avant', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/user' })

    expect(res.statusCode).toBe(401)
  })

  it('un cookie invalide (falsifié) est refusé', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/user', headers: { cookie: 'token=falsifie' } })

    expect(res.statusCode).toBe(401)
  })
})

describe('protection CSRF — requêtes authentifiées par cookie', () => {
  it('refuse une création sans jeton CSRF', async () => {
    const { cookies } = await login()

    const res = await createCategory({ cookie: cookies })

    expect(res.statusCode).toBe(403)
    expect(mockPrisma.category.create).not.toHaveBeenCalled()
  })

  it('refuse un jeton CSRF qui ne correspond pas au cookie', async () => {
    const { cookies } = await login()

    const res = await createCategory({ cookie: cookies, 'x-csrf-token': 'un-jeton-invente' })

    expect(res.statusCode).toBe(403)
    expect(mockPrisma.category.create).not.toHaveBeenCalled()
  })

  it('accepte la création avec le bon jeton CSRF', async () => {
    const { cookies, csrfToken } = await login()

    const res = await createCategory({ cookie: cookies, 'x-csrf-token': csrfToken })

    expect(res.statusCode).toBe(201)
    expect(mockPrisma.category.create).toHaveBeenCalledOnce()
  })

  it('un jeton CSRF issu d\'une AUTRE session (autre cookie) est refusé', async () => {
    const first  = await login()
    const second = await login()

    const res = await createCategory({ cookie: second.cookies, 'x-csrf-token': first.csrfToken })

    expect(res.statusCode).toBe(403)
  })

  it('les routes de lecture (GET) n\'exigent aucun jeton CSRF', async () => {
    const { cookies } = await login()
    mockPrisma.category.findMany.mockResolvedValue([])

    const res = await app.inject({ method: 'GET', url: '/api/categories', headers: { cookie: cookies } })

    expect(res.statusCode).toBe(200)
  })
})

describe('protection CSRF — requêtes authentifiées par Bearer', () => {
  it('un client Bearer n\'a pas besoin de jeton CSRF (il n\'est pas exposé à la contrefaçon)', async () => {
    const token = app.jwt.sign({ userId: USER_ID, email: 'alice@example.com', tv: 0 })

    const res = await createCategory({ authorization: `Bearer ${token}` })

    expect(res.statusCode).toBe(201)
  })

  it('priorité à l\'en-tête Authorization quand cookie ET Bearer sont présents', async () => {
    const { cookies } = await login() // cookie valide, mais SANS jeton CSRF fourni ensuite
    const token = app.jwt.sign({ userId: USER_ID, email: 'alice@example.com', tv: 0 })

    // Le Bearer est utilisé pour l'authentification → pas de vérification CSRF, malgré le cookie présent.
    const res = await createCategory({ cookie: cookies, authorization: `Bearer ${token}` })

    expect(res.statusCode).toBe(201)
  })
})

describe('POST /api/auth/logout', () => {
  it('efface le cookie de session', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/logout' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ loggedOut: true })
    const cookie = res.cookies.find((c: any) => c.name === 'token')
    expect(cookie?.value).toBe('')
    expect(cookie?.expires && new Date(cookie.expires).getTime()).toBeLessThan(Date.now())
  })

  it('idempotent : appelable sans session active', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/logout' })

    expect(res.statusCode).toBe(200)
  })

  it('après logout, l\'ancien cookie ne réauthentifie plus (le JWT était déjà valide, mais le navigateur ne le renverra plus)', async () => {
    // Ce test documente la limite du logout côté serveur pour un JWT stateless : le jeton lui-même
    // reste valide jusqu'à expiration si quelqu'un le rejoue à la main. C'est le cookie — que le
    // navigateur cesse d'envoyer — qui referme la session en pratique, pas une révocation serveur.
    const { cookies } = await login()
    await app.inject({ method: 'POST', url: '/api/auth/logout' })

    const res = await app.inject({ method: 'GET', url: '/api/user', headers: { cookie: cookies } })

    expect(res.statusCode).toBe(200) // le jeton d'origine, rejoué manuellement, fonctionne encore
  })
})
