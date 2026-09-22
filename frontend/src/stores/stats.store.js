import { defineStore } from 'pinia'
import { useApi } from '@/composables/useApi.js'

function emptyStats(from, to, type) {
  return { from, to, type, total: 0, categories: [], timeseries: [] }
}

/** Numéro de la dernière requête de chaque sorte : une réponse arrivée trop tard est ignorée. */
const latest = { current: 0, previous: 0 }

export const useStatsStore = defineStore('stats', {
  state: () => ({
    data:    emptyStats('', '', 'expense'),
    /** Totaux de la période de comparaison (null : pas chargés, ou indisponibles) */
    previous: null,
    periods: { months: [], years: [] },
    loading: false,
    error:   '',
  }),

  actions: {
    async fetch({ from, to, type = 'expense' }) {
      const request = ++latest.current
      this.loading = true
      this.error   = ''
      try {
        const data = await useApi().get(`/api/stats?from=${from}&to=${to}&type=${type}`)
        if (request === latest.current) this.data = data
        return data
      } catch (err) {
        if (request === latest.current) {
          this.error = err.message
          this.data  = emptyStats(from, to, type)
        }
        throw err
      } finally {
        if (request === latest.current) this.loading = false
      }
    },

    /**
     * Total de la période de comparaison. Un échec n'est pas une erreur pour
     * l'utilisateur : on masque simplement la comparaison.
     */
    async fetchPrevious({ from, to, type = 'expense' }) {
      const request = ++latest.previous
      this.previous = null
      try {
        const data = await useApi().get(`/api/stats?from=${from}&to=${to}&type=${type}`)
        if (request === latest.previous) this.previous = { from, to, type, total: data.total }
      } catch {
        if (request === latest.previous) this.previous = null
      }
      return this.previous
    },

    /** Mois et années disposant de transactions — peuple les sélecteurs de période. */
    async fetchPeriods({ type = 'expense' }) {
      try {
        this.periods = await useApi().get(`/api/stats/periods?type=${type}`)
        return this.periods
      } catch {
        this.periods = { months: [], years: [] }
        return this.periods
      }
    },
  },
})
