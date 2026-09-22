<script setup>
defineProps({
  /** Nom accessible — obligatoire : le bouton n'a pas de texte visible. */
  label:   { type: String, required: true },
  /** 'plain' (actions de liste) | 'outline' (rond, dans un header) | 'accent' (pilule menthe) */
  variant: { type: String, default: 'plain' },
  /** Survol en rouge (suppression, déconnexion) */
  danger:  { type: Boolean, default: false },
})
</script>

<template>
  <button
    type="button"
    class="icon-btn"
    :class="[`icon-btn--${variant}`, { 'icon-btn--danger': danger }]"
    :aria-label="label"
  >
    <slot />
  </button>
</template>

<style scoped>
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  transition: color var(--transition-fast), background var(--transition-fast),
              border-color var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}

.icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }

/* ── plain : action discrète dans une liste ── */
.icon-btn--plain {
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
}

.icon-btn--plain:hover:not(:disabled) {
  color: var(--color-primary);
  background: var(--color-primary-subtle);
}

.icon-btn--plain.icon-btn--danger:hover:not(:disabled) {
  color: var(--color-danger);
  background: var(--color-danger-subtle);
}

/* ── outline : bouton rond du header ── */
.icon-btn--outline {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  color: var(--color-text-secondary);
}

.icon-btn--outline:hover:not(:disabled) {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.icon-btn--outline.icon-btn--danger:hover:not(:disabled) {
  color: var(--color-danger);
  border-color: var(--color-danger);
}

/* ── accent : pilule menthe (icône + libellé éventuel) ── */
.icon-btn--accent {
  min-width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-accent);
  background: var(--color-accent-subtle);
  color: var(--color-accent);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
}

.icon-btn--accent:hover:not(:disabled) {
  background: var(--color-accent);
  color: var(--color-text-inverse);
}
</style>
