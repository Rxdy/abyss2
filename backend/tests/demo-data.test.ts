/**
 * Jeu de données du compte de démo (scripts/demo-data.ts) — pur, sans base.
 */

import { describe, it, expect } from 'vitest'
import { buildDemoData, DEMO_BUDGETS, DEMO_ENVELOPES, HISTORY_MONTHS } from '../scripts/demo-data.js'
import { DEFAULT_CATEGORIES } from '../src/routes/auth.js'

const NOW = new Date('2026-09-20T10:00:00Z')

describe('buildDemoData', () => {
  const data = buildDemoData(NOW)

  const defaults   = DEFAULT_CATEGORIES.map((c) => c.name)
  const knownNames = new Set([...defaults, ...data.categories.map((c) => c.name)])

  it('est déterministe pour une même date', () => {
    expect(buildDemoData(NOW)).toEqual(data)
  })

  it('génère un historique fourni', () => {
    expect(data.transactions.length).toBeGreaterThan(100)
    expect(data.recurring.length).toBeGreaterThanOrEqual(10)
  })

  it('ne produit aucune transaction dans le futur', () => {
    const latest = data.transactions.map((t) => t.date).sort().at(-1)!
    expect(latest <= '2026-09-20').toBe(true)
  })

  it('reste dans la fenêtre d\'historique', () => {
    const earliest = data.transactions.map((t) => t.date).sort()[0]
    expect(earliest >= '2026-04-01').toBe(true)
    expect(HISTORY_MONTHS).toBe(6)
  })

  it('utilise des montants entiers et positifs (centimes)', () => {
    for (const t of data.transactions) {
      expect(Number.isInteger(t.amount) && t.amount > 0).toBe(true)
    }
    for (const r of data.recurring) {
      expect(Number.isInteger(r.amount) && r.amount > 0).toBe(true)
    }
  })

  it('trie les transactions de la plus récente à la plus ancienne', () => {
    const dates = data.transactions.map((t) => t.date)
    expect(dates).toEqual([...dates].sort().reverse())
  })

  it('ne référence que des catégories existantes', () => {
    for (const t of data.transactions) {
      if (t.category !== null) expect(knownNames.has(t.category), t.category).toBe(true)
    }
    for (const r of data.recurring) {
      if (r.category !== null) expect(knownNames.has(r.category), r.category).toBe(true)
    }
  })

  it('déclare ses parents avant de s\'en servir (ou les prend dans les catégories par défaut)', () => {
    const seen = new Set(defaults)
    const ordered = [...data.categories].sort((a, b) => Number(!!a.parent) - Number(!!b.parent))
    for (const category of ordered) {
      if (category.parent) expect(seen.has(category.parent), category.parent).toBe(true)
      seen.add(category.name)
    }
  })

  it('mélange dépenses, revenus et opérations sans catégorie', () => {
    expect(data.transactions.some((t) => t.type === 'income')).toBe(true)
    expect(data.transactions.some((t) => t.type === 'expense')).toBe(true)
    expect(data.transactions.some((t) => t.category === null)).toBe(true)
  })

  it('couvre chaque état de charge fixe : active, terminée, en pause, fin de mois', () => {
    expect(data.recurring.some((r) => r.endDate !== null)).toBe(true)
    expect(data.recurring.some((r) => r.pausedAfterSeed)).toBe(true)
    expect(data.recurring.some((r) => r.dayOfMonth > 28)).toBe(true)
    expect(data.recurring.some((r) => r.type === 'income')).toBe(true)
  })

  it('reste équilibré : les revenus fixes couvrent les dépenses fixes', () => {
    const monthly = (type: string) => data.recurring
      .filter((r) => r.type === type && !r.pausedAfterSeed && r.endDate === null)
      .reduce((sum, r) => sum + r.amount, 0)

    expect(monthly('income')).toBeGreaterThan(monthly('expense'))
  })

  it('s\'adapte au jour d\'exécution (début de mois : peu de transactions courantes)', () => {
    const earlyMonth = buildDemoData(new Date('2026-09-02T10:00:00Z'))
    const inSeptember = (d: typeof data) => d.transactions.filter((t) => t.date.startsWith('2026-09'))

    expect(inSeptember(earlyMonth).length).toBeLessThan(inSeptember(data).length)
    expect(earlyMonth.transactions.every((t) => t.date <= '2026-09-02')).toBe(true)
  })

  it('les enveloppes portent sur des catégories qui existent, sans en partager une', () => {
    const all = data.envelopes.flatMap((e) => e.categories)
    for (const name of all) expect(knownNames.has(name), name).toBe(true)
    expect(new Set(all).size).toBe(all.length) // une catégorie n'appartient qu'à une enveloppe
    for (const e of data.envelopes) expect(Number.isInteger(e.budget) && e.budget > 0, e.name).toBe(true)
  })

  it.each([
    ['en début de mois', new Date('2026-09-01T08:00:00Z')],
    ['en milieu de mois', NOW],
    ['en fin de mois', new Date('2026-09-30T20:00:00Z')],
  ])('dépasse toujours une enveloppe ce mois-ci (%s) — la notification du seed ne dépend pas du jour', (_, now) => {
    const run   = buildDemoData(now)
    const month = now.toISOString().slice(0, 7)
    const over  = DEMO_ENVELOPES.filter((envelope) => {
      const spent = run.transactions
        .filter((t) => t.type === 'expense' && t.date.startsWith(month) && t.category && envelope.categories.includes(t.category))
        .reduce((sum, t) => sum + t.amount, 0)
      return spent > envelope.budget
    })
    expect(over.map((e) => e.name)).toContain('Déplacements')
  })

  it('les budgets portent sur des catégories qui existent, en centimes entiers positifs', () => {
    for (const [name, budget] of Object.entries(DEMO_BUDGETS)) {
      expect(knownNames.has(name), name).toBe(true)
      expect(Number.isInteger(budget) && budget > 0, name).toBe(true)
    }
  })
})

