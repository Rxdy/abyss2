/**
 * Remplit un compte de démonstration via l'API (aucun accès direct à la base :
 * chiffrement, validations, génération des charges fixes et des notifications
 * passent par le vrai code).
 *
 *   npm run db:seed        (dans le conteneur : make seed)
 *
 * Idempotent : si le compte existe déjà, il est supprimé (DELETE /api/user,
 * cascade sur toutes ses données) puis recréé.
 *
 * Sert aussi de test de fumée : à la fin, le seed relit le compte et échoue si
 * les notifications attendues ne sont pas apparues (enveloppe dépassée, solde
 * négatif, dépenses non catégorisées) — elles ne sont jamais insérées
 * directement, seulement provoquées par des opérations ordinaires.
 *
 * Variables : SEED_API_URL, SEED_EMAIL, SEED_PASSWORD.
 */

import { DEMO_BUDGETS, buildDemoData } from './demo-data.js'

const API      = process.env.SEED_API_URL ?? `http://localhost:${process.env.API_PORT ?? 3000}`
const EMAIL    = process.env.SEED_EMAIL    ?? 'demo@abyss2.dev'
const PASSWORD = process.env.SEED_PASSWORD ?? 'Tirelire_Abyss-99'

/** Notifications que le seed doit avoir provoquées. */
const EXPECTED_NOTIFICATIONS = ['envelope_overspend', 'negative_balance', 'uncategorized_digest']

async function request(method: string, path: string, body?: unknown, token?: string) {
  return fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body !== undefined && { 'Content-Type': 'application/json' }),
      // Le JWT en Bearer plutôt qu'en cookie : pas de jeton CSRF à gérer (voir utils/session.ts).
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).catch(() => {
    throw new Error(`API injoignable sur ${API} — elle démarre peut-être encore (make api-logs), sinon lancez « make up ».`)
  })
}

/** Appelle l'API et exige le statut `expected` ; `T` décrit la réponse attendue. */
async function must<T = unknown>(method: string, path: string, body: unknown, token: string | undefined, expected: number) {
  const response = await request(method, path, body, token)
  const data = (await response.json().catch(() => null)) as T | null
  if (response.status !== expected) {
    throw new Error(`${method} ${path} → ${response.status} (attendu ${expected}) : ${JSON.stringify(data)}`)
  }
  return data as T
}

/** Ouvre une session et renvoie le JWT, que l'API pose en cookie httpOnly (`token`) ; `null` si refusée. */
async function login(): Promise<string | null> {
  const response = await request('POST', '/api/auth/login', { email: EMAIL, password: PASSWORD })
  if (response.status !== 200) return null

  const cookie = response.headers.getSetCookie().find((c) => c.startsWith('token='))
  if (!cookie) throw new Error('POST /api/auth/login → 200 mais sans cookie de session « token »')
  return cookie.slice('token='.length).split(';')[0]
}

/** Les seuls champs des réponses de l'API dont le seed a besoin. */
interface Named    { id: string; name: string }
interface Titled   { id: string; title: string }
interface Summary  { count: number; balance: number }
interface Notice   { type: string; message: string; read: boolean }

const euros = (cents: number) => (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })
const today = () => new Date().toISOString().slice(0, 10)

async function main() {
  // 1. Repartir d'un compte vierge
  const existing = await login()
  if (existing) {
    await must('DELETE', '/api/user', { password: PASSWORD }, existing, 200)
    console.log(`↺ compte ${EMAIL} existant supprimé`)
  }

  await must('POST', '/api/auth/register', { email: EMAIL, password: PASSWORD }, undefined, 201)
  const token = await login()
  if (!token) throw new Error(`connexion refusée juste après l'inscription de ${EMAIL}`)

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

  const categoryId = (name: string | null) => {
    if (name === null) return null
    const id = idByName.get(name)
    if (!id) throw new Error(`Catégorie inconnue dans le jeu de démo : ${name}`)
    return id
  }

  // Budgets mensuels (catégories d'inscription comprises)
  for (const [name, budget] of Object.entries(DEMO_BUDGETS)) {
    await must('PUT', `/api/categories/${categoryId(name)}`, { budget }, token, 200)
  }

  // 3. Enveloppes — avant les transactions : c'est en saisissant les dépenses que l'API
  //    constate un dépassement et crée la notification.
  for (const envelope of data.envelopes) {
    await must('POST', '/api/envelopes', {
      name: envelope.name, budget: envelope.budget, categoryIds: envelope.categories.map(categoryId),
    }, token, 201)
  }

  // 4. Charges fixes, puis une lecture pour que l'API génère leur historique (salaires compris)
  //    avant les dépenses courantes : le solde ne plonge pas artificiellement pendant le seed.
  for (const r of data.recurring) {
    await must('POST', '/api/recurring', {
      title: r.title, amount: r.amount, type: r.type, dayOfMonth: r.dayOfMonth,
      categoryId: categoryId(r.category), startDate: r.startDate, endDate: r.endDate,
    }, token, 201)
  }
  await must('GET', '/api/transactions?limit=1', undefined, token, 200)

  // Seulement une fois l'historique généré, on met en pause celles qui doivent l'être.
  const recurring = await must<Titled[]>('GET', '/api/recurring', undefined, token, 200)
  for (const r of data.recurring.filter((item) => item.pausedAfterSeed)) {
    const row = recurring.find((item) => item.title === r.title)
    if (!row) throw new Error(`Charge fixe introuvable après création : ${r.title}`)
    await must('PUT', `/api/recurring/${row.id}`, { active: false }, token, 200)
  }

  // 5. Transactions ponctuelles
  for (const t of data.transactions) {
    await must('POST', '/api/transactions', {
      title: t.title, amount: t.amount, date: t.date, type: t.type,
      categoryId: categoryId(t.category), note: t.note,
    }, token, 201)
  }

  // 6. Un coup dur : une réparation qui fait passer le solde sous zéro (notification « solde
  //    négatif »), puis le remboursement de l'assurance, franchise déduite. Montants calculés sur
  //    le solde réel : le passage sous zéro est garanti quel que soit le jour d'exécution.
  const before = await must<Summary>('GET', '/api/summary', undefined, token, 200)
  if (before.balance <= 0) throw new Error(`solde déjà négatif avant la réparation (${euros(before.balance)}) : jeu de démo déséquilibré`)

  const repair     = before.balance + 30000
  const deductible = Math.min(15000, Math.floor(before.balance / 2))
  await must('POST', '/api/transactions', {
    title: 'Réparation chaudière', amount: repair, date: today(), type: 'expense',
    categoryId: categoryId('Logement'), note: 'Intervention en urgence',
  }, token, 201)
  await must('POST', '/api/transactions', {
    title: 'Remboursement assurance habitation', amount: repair - deductible, date: today(), type: 'income',
    categoryId: categoryId('Divers'), note: `Franchise de ${euros(deductible)}`,
  }, token, 201)

  // 7. Bilan, et vérification que le compte est « vivant » : les notifications sont nées des
  //    opérations ci-dessus (la lecture déclenche aussi le digest des dépenses non catégorisées).
  const summary = await must<Summary>('GET', '/api/summary', undefined, token, 200)
  const notices = await must<Notice[]>('GET', '/api/notifications', undefined, token, 200)
  const missing = EXPECTED_NOTIFICATIONS.filter((type) => !notices.some((n) => n.type === type))

  console.log(`✓ ${EMAIL} / ${PASSWORD}`)
  console.log(`  ${data.categories.length} catégories ajoutées, ${Object.keys(DEMO_BUDGETS).length} budgets, ${data.envelopes.length} enveloppes, ${data.transactions.length + 2} transactions saisies, ${data.recurring.length} charges fixes`)
  console.log(`  ${summary.count} transactions au total (charges fixes générées incluses) — solde ${euros(summary.balance)}`)
  console.log(`  ${notices.length} notifications :`)
  for (const notice of notices) console.log(`    • [${notice.type}] ${notice.message}`)

  if (missing.length > 0) throw new Error(`notifications attendues absentes : ${missing.join(', ')}`)
}

main().catch((error) => {
  console.error(`✗ seed échoué : ${error.message}`)
  process.exit(1)
})
