<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label:      { type: String, default: '' },
  hideLabel:  { type: Boolean, default: false },  // libellé lu par les lecteurs d'écran, invisible
  placeholder:{ type: String, default: '' },
  type:       { type: String, default: 'text' },
  /** 'md' (formulaires) | 'sm' (barres de filtres) */
  size:       { type: String, default: 'md' },
  min:        { type: String, default: undefined },
  max:        { type: String, default: undefined },
  error:      { type: String, default: '' },
  hint:       { type: String, default: '' },
  disabled:   { type: Boolean, default: false },
  required:   { type: Boolean, default: false },
  id:         { type: String, default: () => `input-${Math.random().toString(36).slice(2,7)}` },
})
defineEmits(['update:modelValue'])

const showPassword = ref(false)
const isPassword   = computed(() => props.type === 'password')
const inputType    = computed(() => {
  if (isPassword.value) return showPassword.value ? 'text' : 'password'
  return props.type
})
</script>

<template>
  <div class="field" :class="{ 'field--error': error, 'field--disabled': disabled }">
    <label v-if="label" :for="id" class="field__label" :class="{ 'field__label--hidden': hideLabel }">
      {{ label }}
      <span v-if="required" class="field__required" aria-hidden="true">*</span>
    </label>

    <div class="field__input-wrap">
      <input
        :id="id"
        :type="inputType"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        :min="min"
        :max="max"
        :aria-describedby="error ? `${id}-error` : hint ? `${id}-hint` : undefined"
        :aria-invalid="!!error"
        class="field__input"
        :class="[`field__input--${size}`, { 'field__input--has-eye': isPassword }]"
        @input="$emit('update:modelValue', $event.target.value)"
      />

      <button
        v-if="isPassword"
        type="button"
        class="field__eye"
        :aria-label="showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"
        :aria-pressed="showPassword"
        tabindex="-1"
        @click="showPassword = !showPassword"
      >
        <!-- Oeil ouvert -->
        <svg v-if="showPassword" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <!-- Oeil barré -->
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      </button>
    </div>

    <p v-if="error" :id="`${id}-error`" class="field__message field__message--error" role="alert">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${id}-hint`" class="field__message field__message--hint">
      {{ hint }}
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

.field__label--hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.field__required { color: var(--color-danger); margin-left: var(--space-1); }

.field__input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.field__input {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-base);
  color: var(--color-text-primary);
  min-height: 2.75rem;
  width: 100%;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}

.field__input--sm {
  background: var(--color-bg-surface);
  padding: var(--space-2) var(--space-3);
  min-height: 2.25rem;
  font-size: var(--text-sm);
}

.field__input--has-eye { padding-right: 2.75rem; }

/* Les ● des champs password sont gros nativement — on réduit */
.field__input[type="password"] {
  font-size: var(--text-sm);
  letter-spacing: 0.2em;
}

.field__input::placeholder { color: var(--color-text-muted); }

.field__input:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px var(--color-primary-ring);
}

.field--error .field__input { border-color: var(--color-danger); }
.field--disabled .field__input { opacity: 0.5; cursor: not-allowed; }

.field__eye {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 2.75rem;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}

.field__eye:hover { color: var(--color-text-secondary); }

.field__message { font-size: var(--text-xs); }
.field__message--error  { color: var(--color-danger); }
.field__message--hint   { color: var(--color-text-muted); }
</style>
