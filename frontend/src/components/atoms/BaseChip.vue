<script setup>
defineProps({
  /** Bascule active (aria-pressed) */
  active: { type: Boolean, default: false },
  /** 'pill' (filtres) | 'block' (choix pleine largeur dans un formulaire) */
  shape:  { type: String, default: 'pill' },
})
</script>

<template>
  <button
    type="button"
    class="chip"
    :class="[`chip--${shape}`, { 'chip--active': active }]"
    :aria-pressed="active"
  >
    <slot />
  </button>
</template>

<style scoped>
.chip {
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  transition: color var(--transition-fast), border-color var(--transition-fast),
              background var(--transition-fast);
}

.chip--pill {
  padding: var(--space-2) var(--space-3);
  min-height: 2.25rem;
  border-radius: var(--radius-full);
  background: var(--color-bg-surface);
}

.chip--block {
  padding: var(--space-3);
  min-height: 2.75rem;
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
  font-weight: var(--font-medium);
}

.chip--active {
  border-color: var(--color-primary);
  background: var(--color-primary-subtle);
  color: var(--color-primary);
}
</style>
