import { defineStore } from 'pinia'
import { useApi } from '@/composables/useApi.js'

/** Récap vide — évite les `?.` partout dans les composants. */
function emptySummary() {
  return {
    balance: 0,
    income: 0,
    expense: 0,
    monthIncome: 0,
    monthExpense: 0,
    month: '',
    count: 0,
    recent: [],
  }
}

export const useTransactionsStore = defineStore('transactions', {
  state: () => ({
    items:   [],
    total:   0,
    summary: emptySummary(),
    filters: { type: '', categoryId: '', from: '', to: '' },
    loading: false,
    error:   '',
  }),

  getters: {
    isEmpty: (state) => !state.loading && state.items.length === 0,
    hasFilters: (state) => Object.values(state.filters).some(Boolean),
  },

  actions: {
    /** Récapitulatif de l'accueil : solde, totaux du mois, 5 dernières. */
    async fetchSummary() {
      this.loading = true
      this.error   = ''
      try {
        this.summary = await useApi().get('/api/summary')
        return this.summary
      } catch (err) {
        this.error = err.message
        throw err
      } finally {
        this.loading = false
      }
    },

    async fetchAll() {
      this.loading = true
      this.error   = ''
      try {
        const query = new URLSearchParams()
        for (const [key, value] of Object.entries(this.filters)) {
          if (value) query.set(key, value)
        }

        const suffix   = query.toString() ? `?${query}` : ''
        const response = await useApi().get(`/api/transactions${suffix}`)

        this.items = response.items
        this.total = response.total
        return this.items
      } catch (err) {
        this.error = err.message
        throw err
      } finally {
        this.loading = false
      }
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
