<script setup>
/*
 * Bouton radio natif (clavier, groupe par `name`, lecteurs d'écran). Le libellé vient de
 * l'extérieur — typiquement un <label> qui l'enveloppe. `modelValue` : la valeur choisie du groupe.
 */
defineProps({
  modelValue: { type: String, default: '' },
  value:      { type: String, required: true },
  name:       { type: String, required: true },
  disabled:   { type: Boolean, default: false },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <input
    type="radio"
    class="radio"
    :name="name"
    :value="value"
    :checked="modelValue === value"
    :disabled="disabled"
    @change="$emit('update:modelValue', value)"
  >
</template>

<style scoped>
.radio {
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
  margin: 0;
  accent-color: var(--color-primary);
  cursor: pointer;
}

.radio:disabled { cursor: not-allowed; }
</style>
