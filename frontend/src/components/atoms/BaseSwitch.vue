<script setup>
/*
 * Interrupteur on/off : une case à cocher native (clavier, formulaires, lecteurs d'écran) présentée
 * comme un interrupteur (role="switch"). Le libellé vient de l'extérieur — un <label for> ou
 * `aria-label` passé en attribut.
 */
defineProps({
  modelValue: { type: Boolean, default: false },
  disabled:   { type: Boolean, default: false },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <input
    type="checkbox"
    role="switch"
    class="switch"
    :checked="modelValue"
    :aria-checked="modelValue"
    :disabled="disabled"
    @change="$emit('update:modelValue', $event.target.checked)"
  >
</template>

<style scoped>
.switch {
  appearance: none;
  flex-shrink: 0;
  position: relative;
  width: 2.75rem;
  height: 1.5rem;
  border-radius: var(--radius-full);
  background: var(--color-border);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.switch::after {
  content: '';
  position: absolute;
  top: 0.1875rem;
  left: 0.1875rem;
  width: 1.125rem;
  height: 1.125rem;
  border-radius: var(--radius-full);
  background: var(--color-text-inverse, #fff);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.3);
  transition: transform var(--transition-fast);
}

.switch:checked { background: var(--color-primary); }
.switch:checked::after { transform: translateX(1.25rem); }

.switch:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.switch:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
