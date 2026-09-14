<script setup>
import { computed } from 'vue'

/**
 * Icônes SVG inline — trait uniforme sur une grille 24×24.
 * Ajouter une icône = ajouter une entrée dans PATHS.
 */
const PATHS = {
  home:   'M3 10.5 12 3l9 7.5M5 9.5V20a1 1 0 0 0 1 1h3.5v-6h5v6H18a1 1 0 0 0 1-1V9.5',
  user:   'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  mail:   'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM3 7l9 6 9-6',
  clock:  'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  key:    'M15 7a4 4 0 1 1-3.2 6.4L9 16H7v2H5v2H2v-3l6.6-6.6A4 4 0 0 1 15 7Z',
  list:   'M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01',
  tag:    'M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9-9-9ZM7.5 7.5h.01',
  plus:   'M12 5v14M5 12h14',
  chevron:'M9 6l6 6-6 6',
  chart:  'M4 20V10M10 20V4M16 20v-7M22 20H2',
  calendar: 'M7 3v3M17 3v3M3.5 8.5h17M4 6h16a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z',
  devices: 'M4 4h12v9H4z M8 20h4 M9 17v3 M18 10h3v7h-3z',
}

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: 20 },
})

const path = computed(() => PATHS[props.name] ?? '')
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    class="icon"
  >
    <path :d="path" />
  </svg>
</template>

<style scoped>
.icon { display: block; flex-shrink: 0; }
</style>
