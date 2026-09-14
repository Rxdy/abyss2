<script setup>
import { computed } from 'vue'
import { useLink }  from 'vue-router'
import BaseIcon     from '@/components/atoms/BaseIcon.vue'

const props = defineProps({
  to:    { type: String, required: true },
  icon:  { type: String, required: true },
  label: { type: String, required: true },
})

const { isActive } = useLink({ to: computed(() => props.to) })
</script>

<template>
  <RouterLink
    :to="to"
    class="nav-item"
    :class="{ 'nav-item--active': isActive }"
    :aria-current="isActive ? 'page' : undefined"
  >
    <BaseIcon :name="icon" :size="24" />
    <!-- Libellé masqué visuellement sous 1024px (icônes seules), toujours lu
         par les lecteurs d'écran. -->
    <span class="nav-item__label">{{ label }}</span>
  </RouterLink>
</template>

<style scoped>
.nav-item {
  display: flex;
  align-items: center;
  justify-content: center;
  /* Cible tactile confortable */
  min-width: 3rem;
  min-height: 2.75rem;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  transition: color var(--transition-fast), background var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}

.nav-item:hover { color: var(--color-text-secondary); }

.nav-item--active {
  color: var(--color-primary);
  background: var(--color-primary-subtle);
}

/* Mobile + tablette : icône seule, libellé accessible uniquement */
.nav-item__label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

/* Desktop : le libellé revient à côté de l'icône, dans le header */
@media (min-width: 1024px) {
  .nav-item {
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    min-width: 0;
    min-height: 0;
  }

  .nav-item__label {
    position: static;
    width: auto;
    height: auto;
    margin: 0;
    overflow: visible;
    clip: auto;
    clip-path: none;
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
  }
}
</style>
