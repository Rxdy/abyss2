<script setup>
defineOptions({ inheritAttrs: false })

defineProps({
  modelValue: { type: [String, Number], default: '' },
  label:      { type: String, default: '' },
  error:      { type: String, default: '' },
  hint:       { type: String, default: '' },
  /** 'md' (formulaires) | 'sm' (barres de filtres) */
  size:       { type: String, default: 'md' },
  disabled:   { type: Boolean, default: false },
  id:         { type: String, default: () => `select-${Math.random().toString(36).slice(2, 7)}` },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <div class="field" :class="{ 'field--error': error }">
    <label v-if="label" :for="id" class="field__label">{{ label }}</label>

    <select
      :id="id"
      :value="modelValue"
      :disabled="disabled"
      :aria-invalid="!!error"
      :aria-describedby="error ? `${id}-error` : hint ? `${id}-hint` : undefined"
      class="field__select"
      :class="`field__select--${size}`"
      v-bind="$attrs"
      @change="$emit('update:modelValue', $event.target.value)"
    >
      <slot />
    </select>

    <p v-if="error" :id="`${id}-error`" class="field__message field__message--error" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="`${id}-hint`" class="field__message">{{ hint }}</p>
  </div>
</template>

<style scoped>
.field { display: flex; flex-direction: column; gap: var(--space-2); }

.field__label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
}

.field__select {
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
}

.field__select--md {
  background: var(--color-bg-elevated);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  min-height: 2.75rem;
  font-size: var(--text-base);
}

.field__select--sm {
  background: var(--color-bg-surface);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  min-height: 2.25rem;
  font-size: var(--text-sm);
}

.field__select:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px var(--color-primary-ring);
}

.field--error .field__select { border-color: var(--color-danger); }

.field__select:disabled { opacity: 0.5; cursor: not-allowed; }

.field__message { font-size: var(--text-xs); color: var(--color-text-muted); }
.field__message--error { color: var(--color-danger); }
</style>
