import { defineStore } from 'pinia'
import { useApi } from '@/composables/useApi.js'

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    items:       [],
    unreadCount: 0,
    loading:     false,
    error:       '',
    loaded:      false,
  }),

  actions: {
    /** Compte non lu seul — pour le badge, appelé souvent (montage de l'en-tête). */
    async fetchUnreadCount() {
      try {
        const { count } = await useApi().get('/api/notifications/unread-count')
        this.unreadCount = count
        return count
      } catch {
        // Le badge n'est qu'indicatif : une panne réseau ne doit rien casser d'autre.
        return this.unreadCount
      }
    },

    async fetchAll({ archived = false } = {}) {
      this.loading = true
      this.error   = ''
      try {
        this.items  = await useApi().get(`/api/notifications?archived=${archived}`)
        this.loaded = true
        return this.items
      } catch (err) {
        this.error = err.message
        throw err
      } finally {
        this.loading = false
      }
    },

    /** Ouvrir une notification la marque lue — pas d'action explicite « marquer lu ». */
    async markRead(id) {
      const wasUnread = this.items.find((n) => n.id === id)?.read === false

      const updated = await useApi().put(`/api/notifications/${id}`, { read: true })
      const index = this.items.findIndex((n) => n.id === id)
      if (index !== -1) this.items[index] = updated

      if (wasUnread) this.unreadCount = Math.max(0, this.unreadCount - 1)
      return updated
    },

    async archive(id) {
      const wasUnread = this.items.find((n) => n.id === id)?.read === false
      await useApi().put(`/api/notifications/${id}`, { archived: true })
      this.items = this.items.filter((n) => n.id !== id)
      if (wasUnread) this.unreadCount = Math.max(0, this.unreadCount - 1)
    },

    async remove(id) {
      const wasUnread = this.items.find((n) => n.id === id)?.read === false
      await useApi().del(`/api/notifications/${id}`)
      this.items = this.items.filter((n) => n.id !== id)
      if (wasUnread) this.unreadCount = Math.max(0, this.unreadCount - 1)
    },
  },
})
