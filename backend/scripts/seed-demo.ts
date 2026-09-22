/**
 * Remplit un compte de démonstration via l'API (aucun accès direct à la base :
 * chiffrement, validations et génération des charges fixes passent par le vrai
 * code).
 *
 *   npm run db:seed        (dans le conteneur : make seed)
 *
 * Idempotent : si le compte existe déjà, il est supprimé (DELETE /api/user,
 * cascade sur toutes ses données) puis recréé.
 *
 * Variables : SEED_API_URL, SEED_EMAIL, SEED_PASSWORD.
 */

import { DEMO_BUDGETS, buildDemoData } from './demo-data.js'

const API      = process.env.SEED_API_URL ?? `http://localhost:${process.env.API_PORT ?? 3000}`
const EMAIL    = process.env.SEED_EMAIL    ?? 'demo@abyss2.dev'
const PASSWORD = process.env.SEED_PASSWORD ?? 'Tirelire_Abyss-99'

async function call<T = unknown>(method: string, path: string, body?: unknown, token?: string) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => {
    throw new Error(`API injoignable sur ${API} — elle démarre peut-être encore (make api-logs), sinon lancez « make up ».`)
  })
  const data = (await response.json().catch(() => null)) as T | null
  return { status: response.status, data }
}

/** Appelle l'API et exige le statut `expected` ; `T` décrit la réponse attendue. */
async function must<T = unknown>(method: string, path: string, body: unknown, token: string | undefined, expected: number) {
  const { status, data } = await call<T>(method, path, body, token)
  if (status !== expected) {
    throw new Error(`${method} ${path} → ${status} (attendu ${expected}) : ${JSON.stringify(data)}`)
  }
  return data as T
}

/** Les seuls champs des réponses de l'API dont le seed a besoin. */
interface Session  { token: string }
interface Named    { id: string; name: string }
interface Titled   { id: string; title: string }
interface Summary  { count: number; balance: number }

async function main() {
  // 1. Repartir d'un compte vierge
  const existing = await call<Session>('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD })
  if (existing.status === 200 && existing.data) {
    await must('DELETE', '/api/user', { password: PASSWORD }, existing.data.token, 200)
    console.log(`↺ compte ${EMAIL} existant supprimé`)
  }

  await must('POST', '/api/auth/register', { email: EMAIL, password: PASSWORD }, undefined, 201)
  const { token } = await must<Session>('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD }, undefined, 200)

  const data = buildDemoData()

  // 2. Catégories : celles de l'inscription + nos ajouts (parents avant enfants)
  const idByName = new Map<string, string>()
  const listed = await must<Named[]>('GET', '/api/categories', undefined, token, 200)
  for (const category of listed) idByName.set(category.name, category.id)

  const ordered = [...data.categories].sort((a, b) => Number(!!a.parent) - Number(!!b.parent))
  for (const category of ordered) {
    const created = await must<Named>('POST', '/api/categories', {
      name: category.name,
      color: category.color,
      ...(category.parent && { parentId: idByName.get(category.parent) }),
    }, token, 201)
    idByName.set(category.name, created.id)
  }

  // Budgets mensuels (catégories d'inscription comprises)
  for (const [name, budget] of Object.entries(DEMO_BUDGETS)) {
    const id = idByName.get(name)
    if (!id) throw new Error(`Catégorie inconnue pour un budget de démo : ${name}`)
    await must('PUT', `/api/categories/${id}`, { budget }, token, 200)
  }

  const categoryId = (name: string | null) => {
    if (name === null) return null
    const id = idByName.get(name)
    if (!id) throw new Error(`Catégorie inconnue dans le jeu de démo : ${name}`)
    return id
  }

  // 3. Transactions
  for (const t of data.transactions) {
    await must('POST', '/api/transactions', {
      title: t.title, amount: t.amount, date: t.date, type: t.type,
      categoryId: categoryId(t.category), note: t.note,
    }, token, 201)
  }

  // 4. Charges fixes
  for (const r of data.recurring) {
    await must('POST', '/api/recurring', {
      title: r.title, amount: r.amount, type: r.type, dayOfMonth: r.dayOfMonth,
      categoryId: categoryId(r.category), startDate: r.startDate, endDate: r.endDate,
    }, token, 201)
  }

  // 5. L'API génère l'historique des charges fixes à la première lecture ;
  //    seulement ensuite on met en pause celles qui doivent l'être.
  await must('GET', '/api/transactions?limit=1', undefined, token, 200)

  const recurring = await must<Titled[]>('GET', '/api/recurring', undefined, token, 200)
  for (const r of data.recurring.filter((item) => item.pausedAfterSeed)) {
    const row = recurring.find((item) => item.title === r.title)
    if (!row) throw new Error(`Charge fixe introuvable après création : ${r.title}`)
    await must('PUT', `/api/recurring/${row.id}`, { active: false }, token, 200)
  }

  // 6. Bilan
  const summary = await must<Summary>('GET', '/api/summary', undefined, token, 200)
  const euros = (cents: number) => (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })

  console.log(`✓ ${EMAIL} / ${PASSWORD}`)
  console.log(`  ${data.categories.length} catégories ajoutées, ${Object.keys(DEMO_BUDGETS).length} budgets, ${data.transactions.length} transactions saisies, ${data.recurring.length} charges fixes`)
  console.log(`  ${summary.count} transactions au total (charges fixes générées incluses) — solde ${euros(summary.balance)}`)
}

main().catch((error) => {
  console.error(`✗ seed échoué : ${error.message}`)
  process.exit(1)
})
