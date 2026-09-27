<script setup>
/*
 * Pastille de couleur. Deux formes :
 *  - par défaut, un bouton qui sélectionne `color` ;
 *  - `custom`, un sélecteur natif (<input type="color">) habillé en pastille
 *    pointillée avec un « + », qui émet la couleur choisie.
 * Dans les deux cas, `select` porte la couleur.
 */
defineProps({
  color:  { type: String, required: true },
  /** Pastille sélectionnée (aria-pressed) */
  active: { type: Boolean, default: false },
  /** Nom accessible — obligatoire : la pastille n'a pas de texte visible. */
  label:  { type: String, required: true },
  /** Sélecteur natif au lieu d'un bouton */
  custom: { type: Boolean, default: false },
})

defineEmits(['select'])
</script>

<template>
  <label v-if="custom" class="swatch swatch--custom" :style="{ background: color }">
    <input
      type="color"
      class="swatch__native"
      :value="color"
      :aria-label="label"
      @input="$emit('select', $event.target.value)"
    />
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  </label>

  <button
    v-else
    type="button"
    class="swatch"
    :class="{ 'swatch--active': active }"
    :style="{ background: color }"
    :aria-label="label"
    :aria-pressed="active"
    @click="$emit('select', color)"
  />
</template>

<style scoped>
.swatch {
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-full);
  border: 2px solid transparent;
  transition: transform var(--transition-fast), border-color var(--transition-fast);
}

.swatch--active {
  border-color: var(--color-text-primary);
  transform: scale(1.1);
}

.swatch--custom {
  position: relative;
  border: 2px dashed var(--color-border);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-inverse);
  cursor: pointer;
  overflow: hidden;
}

.swatch__native {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  border: none;
  padding: 0;
}
</style>
