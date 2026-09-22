<script setup>
/*
 * Bouton d'action flottant « + » pour l'ajout rapide au pouce. Mobile et
 * tablette seulement : dès 1024 px, les pages ont leur propre bouton « Ajouter ».
 */
defineProps({
  /** Nom accessible — obligatoire : le bouton n'a pas de texte visible. */
  label: { type: String, required: true },
})
</script>

<template>
  <button type="button" class="fab" :aria-label="label">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  </button>
</template>

<style scoped>
.fab {
  position: fixed;
  z-index: calc(var(--z-navbar) + 1);
  right: var(--space-4);
  bottom: calc(var(--navbar-height) + var(--space-4) + env(safe-area-inset-bottom));
  width: 3.5rem;
  height: 3.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  color: var(--color-text-inverse);
  box-shadow: var(--shadow-lg);
  transition: transform var(--transition-fast), background var(--transition-fast);
}

.fab:hover  { background: var(--color-primary-hover, var(--color-primary)); }
.fab:active { transform: scale(0.94); }

@media (min-width: 1024px) {
  .fab { display: none; }
}
</style>
