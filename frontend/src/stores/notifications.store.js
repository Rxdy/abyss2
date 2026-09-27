import { defineStore } from 'pinia'
import { useApi } from '@/composables/useApi.js'
import { useToastStore } from '@/stores/toast.store.js'

/** Les alertes (dépassement, solde négatif) restent un peu plus longtemps qu'un toast de succès. */
const ALERT_DURATION = 6000

export const useNotificationsStore = defineStore('notifications', {
  state: () => ({
    items:       [],
    unreadCount: 0,
    loading:     false,
    error:       '',
    loaded:      false,
    /** Types activés (page Profil) : { envelopeOverspend, negativeBalance, uncategorizedDigest }. */
    settings:    null,
  }),

  actions: {
    /** Compte non lu seul — pour le badge, appelé souvent (montage de l'en-tête). */
    async fetchUnreadCount() {
      try {
        const { count } = await useApi().get('/api/notifications/unread-count')
        if (Number.isInteger(count)) this.unreadCount = count
        return this.unreadCount
      } catch {
        // Le badge n'est qu'indicatif : une panne réseau ne doit rien casser d'autre.
        return this.unreadCount
      }
    },

    /**
     * Après une écriture de transactions : rafraîchit le badge et annonce en toast les
     * notifications apparues entre-temps (enveloppe dépassée, solde négatif) — sans ça, elles
     * n'apparaissaient qu'au prochain chargement de l'app.
     */
    async refreshAfterChange() {
      const before = this.unreadCount
      const count  = await this.fetchUnreadCount()
      if (count <= before) return

      try {
        // Triées de la plus récente à la plus ancienne : les nouvelles sont en tête.
        const active = await useApi().get('/api/notifications?archived=false')
        const toasts = useToastStore()
        active
          .filter((n) => !n.read)
          .slice(0, count - before)
          .forEach((n) => toasts.push(n.message, { tone: 'danger', duration: ALERT_DURATION }))
      } catch {
        // Le badge est déjà à jour : l'annonce n'est qu'un plus.
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

    /** Tout marquer comme lu — les archivées ne sont pas concernées (hors badge). */
    async markAllRead() {
      await useApi().post('/api/notifications/read-all')
      this.items = this.items.map((n) => (n.archived ? n : { ...n, read: true }))
      this.unreadCount = 0
    },

    async fetchSettings() {
      this.settings = await useApi().get('/api/user/notification-settings')
      return this.settings
    },

    /** Change un réglage tout de suite à l'écran ; revient en arrière si l'API refuse. */
    async updateSetting(key, enabled) {
      const previous = this.settings?.[key]
      this.settings = { ...this.settings, [key]: enabled }
      try {
        this.settings = await useApi().put('/api/user/notification-settings', { [key]: enabled })
      } catch (err) {
        this.settings = { ...this.settings, [key]: previous }
        throw err
      }
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
