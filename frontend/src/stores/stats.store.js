import { defineStore } from 'pinia'
import { useApi } from '@/composables/useApi.js'

function emptyStats(from, to, type) {
  return { from, to, type, total: 0, categories: [] }
}

export const useStatsStore = defineStore('stats', {
  state: () => ({
    data:    emptyStats('', '', 'expense'),
    loading: false,
    error:   '',
  }),

  actions: {
    async fetch({ from, to, type = 'expense' }) {
      this.loading = true
      this.error   = ''
      try {
        this.data = await useApi().get(`/api/stats?from=${from}&to=${to}&type=${type}`)
        return this.data
      } catch (err) {
        this.error = err.message
        this.data  = emptyStats(from, to, type)
        throw err
      } finally {
        this.loading = false
      }
    },
  },
})
