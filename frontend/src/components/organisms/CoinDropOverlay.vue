<script setup>
/**
 * Monte une icône animée par déclenchement du store (voir coinDrop.store.js) : la pièce du logo
 * tombe dans la tirelire à chaque transaction ajoutée. `pointer-events: none` — ne bloque jamais
 * les clics, ce n'est qu'une micro-interaction visuelle.
 */
import CoinDropIcon from '@/components/atoms/CoinDropIcon.vue'
import { useCoinDropStore } from '@/stores/coinDrop.store.js'

const coinDrop = useCoinDropStore()
</script>

<template>
  <div class="coin-drop-overlay" aria-hidden="true">
    <CoinDropIcon v-for="play in coinDrop.plays" :key="play.id" />
  </div>
</template>

<style scoped>
.coin-drop-overlay {
  position: fixed;
  top: 4.5rem;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
  z-index: var(--z-toast);
}
</style>
