/**
 * Budgets par catégorie : combien reste-t-il, où en est-on ?
 *
 * Le budget est un plafond de DÉPENSES mensuel, en centimes, porté par une
 * catégorie. Le dépensé d'une catégorie parente comprend ses sous-catégories
 * (c'est ainsi que l'API des statistiques le calcule).
 */

/** À partir de ce taux d'utilisation, on prévient avant le dépassement. */
export const WARN_AT = 0.8

/**
 * Où en est-on par rapport au plafond ?
 *
 * @returns {{ percent: number, status: 'ok' | 'warn' | 'over', remaining: number }}
 *   `percent` peut dépasser 100 (arrondi à l'entier) ; `remaining` est négatif quand on a dépassé.
 */
export function budgetStatus(spent, budget) {
  const ratio = budget > 0 ? spent / budget : 0
  const status = spent > budget ? 'over' : ratio >= WARN_AT ? 'warn' : 'ok'
  return { percent: Math.round(ratio * 100), status, remaining: budget - spent }
}

/** Montant dépensé par identifiant de catégorie, sous-catégories comprises. */
export function spentByCategory(statsCategories = []) {
  const spent = new Map()
  for (const category of statsCategories) {
    if (category.id) spent.set(category.id, category.amount)
    for (const child of category.children ?? []) {
      if (child.id) spent.set(child.id, child.amount)
    }
  }
  return spent
}

/**
 * Les catégories qui ont un budget, avec leur consommation du mois : les plus
 * avancées (ou déjà dépassées) d'abord, puis par nom.
 */
export function buildBudgets(categories = [], statsCategories = []) {
  const spent = spentByCategory(statsCategories)

  return categories
    .filter((category) => category.budget > 0)
    .map((category) => {
      const used = spent.get(category.id) ?? 0
      return {
        id: category.id,
        name: category.name,
        color: category.color,
        budget: category.budget,
        spent: used,
        ...budgetStatus(used, category.budget),
      }
    })
    .sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name, 'fr'))
}
