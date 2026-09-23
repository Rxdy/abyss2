import { defineStore } from 'pinia'

/** Durée de l'animation (voir CoinDropIcon.vue) + marge avant de retirer l'instance du DOM. */
export const COIN_DROP_DURATION = 1000

let nextId = 1

/** Micro-interaction éphémère jouée à l'ajout d'une transaction (voir CoinDropOverlay.vue). */
export const useCoinDropStore = defineStore('coinDrop', {
  state: () => ({
    plays: [], // [{ id }]
  }),

  actions: {
    trigger() {
      const id = nextId++
      this.plays.push({ id })
      setTimeout(() => {
        this.plays = this.plays.filter((play) => play.id !== id)
      }, COIN_DROP_DURATION)
      return id
    },
  },
})
