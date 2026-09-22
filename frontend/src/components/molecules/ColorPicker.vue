<script setup>
/*
 * Choix d'une couleur : palette prédéfinie + sélecteur libre.
 * v-model = couleur '#rrggbb'.
 */
import { useId } from 'vue'
import ColorSwatch from '@/components/atoms/ColorSwatch.vue'
import { CATEGORY_COLORS } from '@/utils/palette.js'

defineProps({
  palette: { type: Array, default: () => CATEGORY_COLORS },
  label:   { type: String, default: 'Couleur' },
})

const color = defineModel({ type: String, required: true })
const labelId = `color-label-${useId()}`
</script>

<template>
  <div class="color-picker">
    <span class="color-picker__label" :id="labelId">{{ label }}</span>
    <div class="color-picker__palette" role="group" :aria-labelledby="labelId">
      <ColorSwatch
        v-for="option in palette"
        :key="option"
        :color="option"
        :active="color === option"
        :label="`Couleur ${option}`"
        @select="color = $event"
      />
      <ColorSwatch custom :color="color" label="Choisir une couleur personnalisée" @select="color = $event" />
    </div>
  </div>
</template>

<style scoped>
.color-picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.color-picker__label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
}

.color-picker__palette {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
