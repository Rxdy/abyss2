/**
 * Jeu de données du compte de démonstration — fonction pure, sans I/O.
 *
 * Génère 6 mois d'historique (les 5 mois précédents + le mois courant jusqu'à
 * aujourd'hui) : charges fixes, dépenses courantes, quelques revenus
 * ponctuels, une transaction sans catégorie… de quoi remplir chaque écran
 * (accueil, transactions, catégories, charges fixes, statistiques).
 *
 * Déterministe : un PRNG à graine fixe donne toujours la même forme de
 * données ; seules les dates suivent le jour d'exécution.
 * Montants en centimes, dates en 'YYYY-MM-DD' (UTC).
 */

export interface DemoCategory {
  name: string
  color: string
  /** Nom de la catégorie parente (sous-catégorie) — les parents par défaut sont créés à l'inscription. */
  parent?: string
}

export interface DemoTransaction {
  title: string
  amount: number
  date: string
  type: 'expense' | 'income'
  category: string | null
  note: string | null
}

export interface DemoRecurring {
  title: string
  amount: number
  type: 'expense' | 'income'
  dayOfMonth: number
  category: string | null
  startDate: string
  endDate: string | null
  /** Créée active (pour générer l'historique) puis mise en pause. */
  pausedAfterSeed: boolean
}

export interface DemoData {
  categories: DemoCategory[]
  transactions: DemoTransaction[]
  recurring: DemoRecurring[]
}

/** Nombre de mois d'historique, mois courant compris. */
export const HISTORY_MONTHS = 6

/**
 * Budgets mensuels du compte de démo (en centimes), par nom de catégorie. Choisis pour que la
 * démonstration montre les trois états d'une jauge : large (Alimentation), à surveiller (Loisirs)
 * et dépassé (Transport).
 */
export const DEMO_BUDGETS: Record<string, number> = {
  Alimentation: 40000,
  Loisirs:      12000,
  Transport:    12000,
}

// Catégories créées par l'inscription (routes/auth.ts) : on n'y touche pas.
// Ici : ce qu'on ajoute par-dessus — un revenu, du shopping, et des sous-catégories.
const CATEGORIES: DemoCategory[] = [
  { name: 'Salaire',    color: '#fb923c' },
  { name: 'Shopping',   color: '#f472b6' },
  { name: 'Courses',    color: '#4dde93', parent: 'Alimentation' },
  { name: 'Restaurants',color: '#86efac', parent: 'Alimentation' },
  { name: 'Carburant',  color: '#488efe', parent: 'Transport' },
  { name: 'Transports en commun', color: '#93c5fd', parent: 'Transport' },
  { name: 'Sorties',    color: '#facc15', parent: 'Loisirs' },
  { name: 'Sport',      color: '#fde047', parent: 'Loisirs' },
  { name: 'Voyages',    color: '#fbbf24', parent: 'Loisirs' },
]

/** Dépenses courantes : `count` opérations par mois, montants tirés dans `amount` (centimes). */
const VARIABLE_SPENDING = [
  { category: 'Courses',     titles: ['Carrefour', 'Monoprix', 'Lidl', 'Biocoop', 'Picard'],            count: [6, 9], amount: [1500, 9500] },
  { category: 'Restaurants', titles: ['Boulangerie', 'Sushi', 'Pizzeria', 'Café', 'Brasserie'],         count: [2, 4], amount: [450, 4800] },
  { category: 'Carburant',   titles: ['TotalEnergies', 'Esso', 'Intermarché carburant'],                count: [1, 2], amount: [4500, 7000] },
  { category: 'Santé',       titles: ['Pharmacie', 'Médecin généraliste', 'Opticien'],                  count: [0, 1], amount: [800, 3500] },
  { category: 'Sorties',     titles: ['Cinéma', 'Concert', 'Bar', 'Bowling'],                           count: [2, 3], amount: [1000, 6000] },
  { category: 'Shopping',    titles: ['Amazon', 'Decathlon', 'Zara', 'Fnac'],                           count: [1, 2], amount: [2500, 12000] },
  { category: 'Divers',      titles: ['Cadeau anniversaire', 'Timbres', 'Pressing'],                    count: [0, 2], amount: [500, 4000] },
] as const

const NOTES = ['Ticket conservé', 'Partagé avec Julie', 'Payé en deux fois', 'À rembourser', 'Bon plan']

/** Charges fixes mensuelles (l'API génère ensuite les transactions du passé). */
const RECURRING = [
  { title: 'Salaire',            amount: 235000, type: 'income',  dayOfMonth: 2,  category: 'Salaire' },
  { title: 'Loyer',              amount: 72000,  type: 'expense', dayOfMonth: 5,  category: 'Logement' },
  { title: 'Électricité',        amount: 6800,   type: 'expense', dayOfMonth: 12, category: 'Logement' },
  { title: 'Internet',           amount: 2999,   type: 'expense', dayOfMonth: 8,  category: 'Abonnements' },
  { title: 'Netflix',            amount: 1349,   type: 'expense', dayOfMonth: 15, category: 'Abonnements' },
  { title: 'Spotify',            amount: 1099,   type: 'expense', dayOfMonth: 18, category: 'Abonnements' },
  { title: 'Salle de sport',     amount: 2990,   type: 'expense', dayOfMonth: 3,  category: 'Sport' },
  { title: 'Pass Navigo',        amount: 8640,   type: 'expense', dayOfMonth: 1,  category: 'Transports en commun' },
  { title: 'Mutuelle',           amount: 4200,   type: 'expense', dayOfMonth: 10, category: 'Santé' },
  // 29 → ramené au dernier jour en février : exerce le cas limite
  { title: 'Virement épargne',   amount: 20000,  type: 'expense', dayOfMonth: 29, category: 'Épargne' },
] as const

// ── Utilitaires ─────────────────────────────────────────────

/** PRNG mulberry32 — petit, rapide, déterministe. */
function createRandom(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pad2 = (n: number) => String(n).padStart(2, '0')

function isoDate(year: number, month0: number, day: number) {
  const d = new Date(Date.UTC(year, month0, day))
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

function daysInMonth(year: number, month0: number) {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()
}

// ── Génération ──────────────────────────────────────────────

export function buildDemoData(now: Date = new Date()): DemoData {
  const random = createRandom(20260920)
  const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1))
  const pick = <T,>(list: readonly T[]) => list[Math.floor(random() * list.length)]

  const year  = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const today = now.getUTCDate()

  const transactions: DemoTransaction[] = []

  const add = (t: Omit<DemoTransaction, 'note'> & { note?: string | null }) =>
    transactions.push({ note: null, ...t })

  // Du plus ancien au mois courant
  for (let offset = HISTORY_MONTHS - 1; offset >= 0; offset--) {
    const y  = year
    const m0 = month - offset
    const monthLength = daysInMonth(y, m0)
    // Mois courant : on ne génère rien dans le futur, et on réduit le volume
    const lastDay = offset === 0 ? today : monthLength
    const share   = lastDay / monthLength

    for (const spec of VARIABLE_SPENDING) {
      const count = Math.round(between(spec.count[0], spec.count[1]) * share)
      for (let i = 0; i < count; i++) {
        add({
          title:    pick(spec.titles),
          amount:   between(spec.amount[0], spec.amount[1]),
          date:     isoDate(y, m0, between(1, lastDay)),
          type:     'expense',
          category: spec.category,
          note:     random() < 0.12 ? pick(NOTES) : null,
        })
      }
    }
  }

  // Événements ponctuels, placés par rapport au mois courant
  add({ title: 'Prime exceptionnelle',       amount: 45000, date: isoDate(year, month - 3, 15), type: 'income',  category: 'Salaire', note: 'Prime de résultats' })
  add({ title: 'Vente Vinted',               amount: 5800,  date: isoDate(year, month - 4, 9),  type: 'income',  category: 'Divers' })
  add({ title: 'Vente Vinted',               amount: 3500,  date: isoDate(year, month - 1, 21), type: 'income', category: 'Divers' })
  add({ title: 'Remboursement mutuelle',     amount: 4200,  date: isoDate(year, month - 2, 18), type: 'income',  category: 'Santé' })
  add({ title: 'Week-end à Lyon (train + hôtel)', amount: 24600, date: isoDate(year, month - 2, 6), type: 'expense', category: 'Voyages', note: 'Réservé 3 semaines avant' })
  add({ title: 'Retrait distributeur',       amount: 4000,  date: isoDate(year, month - 1, 12), type: 'expense', category: null })
  add({ title: 'Remboursement ami',          amount: 2500,  date: isoDate(year, month - 1, 25), type: 'income',  category: null })

  transactions.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  const firstMonth = isoDate(year, month - (HISTORY_MONTHS - 1), 1)

  const recurring: DemoRecurring[] = RECURRING.map((r) => ({
    ...r,
    startDate: firstMonth,
    endDate: null,
    pausedAfterSeed: false,
  }))

  // Une charge terminée (endDate passée) et une en pause : les deux états à l'écran
  recurring.push(
    {
      title: 'Prêt étudiant', amount: 15000, type: 'expense', dayOfMonth: 20, category: 'Divers',
      startDate: firstMonth, endDate: isoDate(year, month - 2, 28), pausedAfterSeed: false,
    },
    {
      title: 'Abonnement presse', amount: 999, type: 'expense', dayOfMonth: 22, category: 'Abonnements',
      startDate: firstMonth, endDate: null, pausedAfterSeed: true,
    },
  )

  return { categories: CATEGORIES, transactions, recurring }
}
