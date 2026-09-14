import { defineStore } from 'pinia'
import { useApi } from '@/composables/useApi.js'

export const useCategoriesStore = defineStore('categories', {
  state: () => ({
    items:   [],
    loading: false,
    error:   '',
    loaded:  false,
  }),

  getters: {
    byId: (state) => (id) => state.items.find((category) => category.id === id) ?? null,
    isEmpty: (state) => state.loaded && state.items.length === 0,
    /** Catégories de premier niveau (pas de sous-catégorie). */
    topLevel: (state) => state.items.filter((category) => !category.parentId),
    /** Sous-catégories d'une catégorie donnée. */
    childrenOf: (state) => (id) => state.items.filter((category) => category.parentId === id),
    /** Liste plate pour un <select> : chaque catégorie principale suivie de ses sous-catégories indentées. */
    flatOptions() {
      return this.topLevel.flatMap((category) => [
        { id: category.id, label: category.name },
        ...this.childrenOf(category.id).map((child) => ({ id: child.id, label: `↳ ${child.name}` })),
      ])
    },
  },

  actions: {
    async fetchAll({ force = false } = {}) {
      if (this.loaded && !force) return this.items

      this.loading = true
      this.error   = ''
      try {
        this.items  = await useApi().get('/api/categories')
        this.loaded = true
        return this.items
      } catch (err) {
        this.error = err.message
        throw err
      } finally {
        this.loading = false
      }
    },

    async create({ name, color, parentId }) {
      const created = await useApi().post('/api/categories', { name, color, parentId: parentId ?? null })
      this.items.push(created)
      return created
    },

    async update(id, payload) {
      const updated = await useApi().put(`/api/categories/${id}`, payload)
      const index   = this.items.findIndex((category) => category.id === id)
      if (index !== -1) this.items[index] = updated
      return updated
    },

    /**
     * Supprime une catégorie. Si `reassignTo` est fourni, les transactions
     * qui utilisaient cette catégorie basculent d'abord vers celle-ci ;
     * sinon elles restent en base mais sans catégorie affiliée. Les
     * éventuelles sous-catégories sont conservées et promues au premier
     * niveau (parentId → null), on rafraîchit donc la liste plutôt que de
     * seulement retirer l'entrée supprimée.
     */
    async remove(id, { reassignTo = null } = {}) {
      await useApi().del(`/api/categories/${id}`, { reassignTo })
      await this.fetchAll({ force: true })
    },
  },
})
