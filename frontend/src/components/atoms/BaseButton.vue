<script setup>
const emit = defineEmits(['click'])

defineProps({
  /** 'primary' | 'secondary' | 'ghost' | 'danger' */
  variant: { type: String, default: 'primary' },
  /** 'sm' | 'md' | 'lg' */
  size:    { type: String, default: 'md' },
  disabled:{ type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  type:    { type: String, default: 'button' },
  full:    { type: Boolean, default: false },
})
</script>

<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="[
      'btn',
      `btn--${variant}`,
      `btn--${size}`,
      { 'btn--full': full, 'btn--loading': loading }
    ]"
    v-bind="$attrs"
    @click="emit('click', $event)"
  >
    <span v-if="loading" class="btn__spinner" aria-hidden="true" />
    <slot />
  </button>
</template>

<style scoped>
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-weight: var(--font-semibold);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast),
              border-color var(--transition-fast), opacity var(--transition-fast);
  white-space: nowrap;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

/* Sizes */
.btn--sm { padding: var(--space-2) var(--space-3); font-size: var(--text-sm);  min-height: 2rem; }
.btn--md { padding: var(--space-3) var(--space-5); font-size: var(--text-base); min-height: 2.75rem; }
.btn--lg { padding: var(--space-4) var(--space-6); font-size: var(--text-lg);  min-height: 3.25rem; }

.btn--full { width: 100%; }

/* Variants */
.btn--primary {
  background: var(--color-primary);
  color: var(--color-text-inverse);
}
.btn--primary:hover:not(:disabled) { background: var(--color-primary-hover); }

.btn--secondary {
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  border-color: var(--color-border);
}
.btn--secondary:hover:not(:disabled) { border-color: var(--color-primary); }

.btn--ghost {
  background: transparent;
  color: var(--color-text-secondary);
}
.btn--ghost:hover:not(:disabled) {
  background: var(--color-primary-subtle);
  color: var(--color-primary);
}

.btn--danger {
  background: var(--color-danger-subtle);
  color: var(--color-danger);
  border-color: var(--color-danger);
}
.btn--danger:hover:not(:disabled) { background: var(--color-danger); color: #fff; }

/* States */
.btn:disabled,
.btn--loading { opacity: 0.5; cursor: not-allowed; pointer-events: none; }

/* Spinner */
.btn__spinner {
  width: 1em;
  height: 1em;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: btn-spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes btn-spin { to { transform: rotate(360deg); } }
</style>
