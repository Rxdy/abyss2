import { defineStore } from 'pinia'

/** Durée d'affichage par défaut (ms). */
export const TOAST_DURATION = 3500

let nextId = 1

/** Notifications éphémères (succès des créations, modifications, suppressions). */
export const useToastStore = defineStore('toast', {
  state: () => ({
    items: [], // [{ id, message, tone: 'success' | 'danger' }]
  }),

  actions: {
    push(message, { tone = 'success', duration = TOAST_DURATION } = {}) {
      const id = nextId++
      this.items.push({ id, message, tone })
      if (duration > 0) setTimeout(() => this.dismiss(id), duration)
      return id
    },

    success(message, options) {
      return this.push(message, { ...options, tone: 'success' })
    },

    dismiss(id) {
      this.items = this.items.filter((toast) => toast.id !== id)
    },
  },
})
