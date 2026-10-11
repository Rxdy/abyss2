<script setup>
/*
 * Zone de texte sur plusieurs lignes — même habillage que BaseInput (libellé, aide, erreur).
 * Avec `maxlength`, un compteur de caractères remplace l'aide quand on approche de la limite.
 */
import { computed } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps({
  modelValue: { type: String, default: '' },
  label:      { type: String, default: '' },
  placeholder:{ type: String, default: '' },
  rows:       { type: Number, default: 5 },
  maxlength:  { type: Number, default: undefined },
  error:      { type: String, default: '' },
  hint:       { type: String, default: '' },
  disabled:   { type: Boolean, default: false },
  required:   { type: Boolean, default: false },
  id:         { type: String, default: () => `textarea-${Math.random().toString(36).slice(2,7)}` },
})
defineEmits(['update:modelValue'])

// Le compteur n'apparaît qu'au-delà de 80 % de la limite : inutile de l'afficher pour trois mots.
const counter = computed(() => {
  if (!props.maxlength || props.modelValue.length < props.maxlength * 0.8) return ''
  return `${props.modelValue.length} / ${props.maxlength}`
})
</script>

<template>
  <div class="field" :class="{ 'field--error': error, 'field--disabled': disabled }">
    <label v-if="label" :for="id" class="field__label">
      {{ label }}
      <span v-if="required" class="field__required" aria-hidden="true">*</span>
    </label>

    <textarea
      v-bind="$attrs"
      :id="id"
      :value="modelValue"
      :placeholder="placeholder"
      :rows="rows"
      :maxlength="maxlength"
      :disabled="disabled"
      :required="required"
      :aria-describedby="error ? `${id}-error` : (counter || hint) ? `${id}-hint` : undefined"
      :aria-invalid="!!error"
      class="field__textarea"
      @input="$emit('update:modelValue', $event.target.value)"
    />

    <p v-if="error" :id="`${id}-error`" class="field__message field__message--error" role="alert">
      {{ error }}
    </p>
    <p v-else-if="counter || hint" :id="`${id}-hint`" class="field__message field__message--hint">
      {{ counter || hint }}
    </p>
  </div>
</template>

<style scoped>
.field { display: flex; flex-direction: column; gap: var(--space-2); }

.field__label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
}

.field__required { color: var(--color-danger); margin-left: var(--space-1); }

.field__textarea {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  /* 16 px minimum : en dessous, iOS zoome sur le champ au toucher */
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  color: var(--color-text-primary);
  width: 100%;
  resize: vertical;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}

.field__textarea::placeholder { color: var(--color-text-muted); }

.field__textarea:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px var(--color-primary-ring);
}

.field--error .field__textarea { border-color: var(--color-danger); }
.field--disabled .field__textarea { opacity: 0.5; cursor: not-allowed; }

.field__message { font-size: var(--text-xs); }
.field__message--error { color: var(--color-danger); }
.field__message--hint  { color: var(--color-text-muted); }
</style>
