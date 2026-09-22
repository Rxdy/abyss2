import { defineStore } from 'pinia'
import { useApi } from '@/composables/useApi.js'
import { matchesSearch } from '@/utils/search.js'

/** Récap vide — évite les `?.` partout dans les composants. */
function emptySummary() {
  return {
    balance: 0,
    income: 0,
    expense: 0,
    monthIncome: 0,
    monthExpense: 0,
    month: '',
    currentMonth: '',
    firstMonth: null,
    count: 0,
    recent: [],
  }
}

/** Taille d'une page de résultats (l'API plafonne à 200). */
export const PAGE_SIZE = 50

export const useTransactionsStore = defineStore('transactions', {
  state: () => ({
    items:   [],
    total:   0,
    summary: emptySummary(),
    filters: { type: '', categoryId: '', from: '', to: '' },
    /** Recherche par libellé — côté client uniquement (les libellés sont chiffrés en base). */
    search:  '',
    loading: false,
    loadingMore: false,
    error:   '',
  }),

  getters: {
    isEmpty: (state) => !state.loading && state.items.length === 0,
    hasFilters: (state) => Object.values(state.filters).some(Boolean) || state.search.trim() !== '',
    /** Les transactions chargées qui correspondent à la recherche (toutes, sans recherche). */
    visibleItems: (state) => state.search.trim() ? state.items.filter((t) => matchesSearch(t, state.search)) : state.items,
    /** Des transactions restent à charger (la liste n'affiche qu'une page à la fois). */
    hasMore: (state) => state.items.length < state.total,
    remaining: (state) => Math.max(0, state.total - state.items.length),
  },

  actions: {
    /**
     * Récapitulatif de l'accueil : solde global, totaux d'un mois (le mois courant sans argument) et
     * ses 5 dernières transactions.
     */
    async fetchSummary({ month = '' } = {}) {
      this.loading = true
      this.error   = ''
      try {
        this.summary = await useApi().get(`/api/summary${month ? `?month=${month}` : ''}`)
        return this.summary
      } catch (err) {
        this.error = err.message
        throw err
      } finally {
        this.loading = false
      }
    },

    /** Filtres courants + pagination → query string. */
    buildQuery(offset = 0) {
      const query = new URLSearchParams()
      for (const [key, value] of Object.entries(this.filters)) {
        if (value) query.set(key, value)
      }
      query.set('limit', String(PAGE_SIZE))
      if (offset > 0) query.set('offset', String(offset))
      return query.toString()
    },

    /** Recharge la première page (à chaque changement de filtre). */
    async fetchAll() {
      this.loading = true
      this.error   = ''
      try {
        const response = await useApi().get(`/api/transactions?${this.buildQuery()}`)

        this.items = response.items
        this.total = response.total
        if (this.search.trim()) this.loadAll().catch(() => {})
        return this.items
      } catch (err) {
        this.error = err.message
        throw err
      } finally {
        this.loading = false
      }
    },

    /** Charge la page suivante et l'ajoute à la liste. */
    async loadMore() {
      if (this.loadingMore || !this.hasMore) return this.items

      const filtersAtStart = JSON.stringify(this.filters)

      this.loadingMore = true
      this.error       = ''
      try {
        const response = await useApi().get(`/api/transactions?${this.buildQuery(this.items.length)}`)

        // Un filtre a changé pendant l'appel : cette page appartient à l'ancienne liste.
        if (JSON.stringify(this.filters) !== filtersAtStart) return this.items

        this.items = [...this.items, ...response.items]
        this.total = response.total
        return this.items
      } catch (err) {
        this.error = err.message
        throw err
      } finally {
        this.loadingMore = false
      }
    },

    /** Charge toutes les pages restantes — une recherche doit porter sur l'ensemble des résultats. */
    async loadAll() {
      while (this.hasMore && !this.loadingMore) {
        const before = this.items.length
        await this.loadMore()
        if (this.items.length === before) break
      }
      return this.items
    },

    /** Filtre la liste localement ; charge le reste des pages pour ne rien rater. */
    setSearch(value) {
      this.search = value
      if (value.trim()) return this.loadAll()
      return Promise.resolve(this.items)
    },

    setFilter(key, value) {
      this.filters[key] = value
      return this.fetchAll()
    },

    /** Change from/to en un seul appel (évite un fetch par borne changée). */
    setDateRange({ from = '', to = '' } = {}) {
      this.filters.from = from
      this.filters.to   = to
      return this.fetchAll()
    },

    resetFilters() {
      this.filters = { type: '', categoryId: '', from: '', to: '' }
      this.search  = ''
      return this.fetchAll()
    },

    async create(payload) {
      const created = await useApi().post('/api/transactions', payload)
      this.items.unshift(created)
      this.total += 1
      return created
    },

    async update(id, payload) {
      const updated = await useApi().put(`/api/transactions/${id}`, payload)
      const index   = this.items.findIndex((transaction) => transaction.id === id)
      if (index !== -1) this.items[index] = updated
      return updated
    },

    async remove(id) {
      await useApi().del(`/api/transactions/${id}`)
      this.items = this.items.filter((transaction) => transaction.id !== id)
      this.total = Math.max(0, this.total - 1)
    },
  },
})
