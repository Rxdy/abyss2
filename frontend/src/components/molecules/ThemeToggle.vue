<script setup>
import { useAppStore } from '@/stores/app.store.js'

const app = useAppStore()
</script>

<template>
  <button
    type="button"
    class="theme-toggle"
    :aria-label="app.isDark ? 'Passer en thème clair' : 'Passer en thème sombre'"
    :aria-pressed="app.isLight"
    @click="app.toggleTheme()"
  >
    <!-- Soleil (affiché en thème sombre : cliquer → thème clair) -->
    <svg v-if="app.isDark" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
    <!-- Lune (affichée en thème clair : cliquer → thème sombre) -->
    <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  color: var(--color-text-secondary);
  transition: color var(--transition-fast), border-color var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}

.theme-toggle:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}
</style>
