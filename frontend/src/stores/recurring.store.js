import { defineStore } from 'pinia'
import { useApi } from '@/composables/useApi.js'

export const useRecurringStore = defineStore('recurring', {
  state: () => ({
    items:   [],
    loading: false,
    error:   '',
    loaded:  false,
  }),

  getters: {
    active:   (state) => state.items.filter((item) => item.active),
    paused:   (state) => state.items.filter((item) => !item.active),
    /** Total mensuel (dépenses - revenus fixes actifs), en centimes. */
    monthlyNet: (state) => state.items
      .filter((item) => item.active)
      .reduce((total, item) => total + (item.type === 'expense' ? -item.amount : item.amount), 0),
  },

  actions: {
    async fetchAll({ force = false } = {}) {
      if (this.loaded && !force) return this.items

      this.loading = true
      this.error   = ''
      try {
        this.items  = await useApi().get('/api/recurring')
        this.loaded = true
        return this.items
      } catch (err) {
        this.error = err.message
        throw err
      } finally {
        this.loading = false
      }
    },

    async create(payload) {
      const created = await useApi().post('/api/recurring', payload)
      this.items.push(created)
      return created
    },

    async update(id, payload) {
      const updated = await useApi().put(`/api/recurring/${id}`, payload)
      const index   = this.items.findIndex((item) => item.id === id)
      if (index !== -1) this.items[index] = updated
      return updated
    },

    /** Bascule pause/reprise sans toucher au reste du modèle. */
    async toggleActive(item) {
      return this.update(item.id, { active: !item.active })
    },

    async remove(id) {
      await useApi().del(`/api/recurring/${id}`)
      this.items = this.items.filter((item) => item.id !== id)
    },
  },
})
