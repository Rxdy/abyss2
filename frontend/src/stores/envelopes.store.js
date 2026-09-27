import { defineStore } from 'pinia'
import { useApi } from '@/composables/useApi.js'

export const useEnvelopesStore = defineStore('envelopes', {
  state: () => ({
    items:   [],
    loading: false,
    error:   '',
    loaded:  false,
  }),

  getters: {
    byId: (state) => (id) => state.items.find((envelope) => envelope.id === id) ?? null,
  },

  actions: {
    async fetchAll({ force = false } = {}) {
      if (this.loaded && !force) return this.items

      this.loading = true
      this.error   = ''
      try {
        this.items  = await useApi().get('/api/envelopes')
        this.loaded = true
        return this.items
      } catch (err) {
        this.error = err.message
        throw err
      } finally {
        this.loading = false
      }
    },

    async create({ name, budget, categoryIds = [] }) {
      const created = await useApi().post('/api/envelopes', { name, budget, categoryIds })
      this.items.push(created)
      return created
    },

    async update(id, payload) {
      const updated = await useApi().put(`/api/envelopes/${id}`, payload)
      const index   = this.items.findIndex((envelope) => envelope.id === id)
      if (index !== -1) this.items[index] = updated
      return updated
    },

    async remove(id) {
      await useApi().del(`/api/envelopes/${id}`)
      this.items = this.items.filter((envelope) => envelope.id !== id)
    },
  },
})
