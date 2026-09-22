<script setup>
/*
 * Case-jour d'un calendrier. Le parent calcule l'état ; le clic et le survol
 * remontent tels quels (le composant n'a qu'un élément racine : les écouteurs
 * @click / @mouseenter posés dessus s'appliquent au bouton).
 */
defineProps({
  day:     { type: Number, required: true },
  /** Jour d'un mois voisin, affiché estompé */
  outside: { type: Boolean, default: false },
  today:   { type: Boolean, default: false },
  /** Bornes et intérieur de la plage sélectionnée */
  start:   { type: Boolean, default: false },
  end:     { type: Boolean, default: false },
  inRange: { type: Boolean, default: false },
})
</script>

<template>
  <button
    type="button"
    class="day"
    :class="{
      'day--outside': outside,
      'day--today': today,
      'day--start': start,
      'day--end': end,
      'day--in-range': inRange,
    }"
    :aria-pressed="start || end"
  >
    {{ day }}
  </button>
</template>

<style scoped>
.day {
  position: relative;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-sm);
  color: var(--color-text-primary);
  border-radius: var(--radius-full);
  transition: background var(--transition-fast), color var(--transition-fast);
}

.day:hover { background: var(--color-primary-subtle); }

.day--outside { color: var(--color-text-muted); opacity: 0.5; }

.day--today {
  box-shadow: inset 0 0 0 1px var(--color-primary);
}

.day--in-range {
  background: var(--color-primary-subtle);
  border-radius: 0;
}

.day--start.day--end { border-radius: var(--radius-full); }
.day--start { border-top-right-radius: 0; border-bottom-right-radius: 0; }
.day--end   { border-top-left-radius: 0;  border-bottom-left-radius: 0; }

.day--start,
.day--end {
  background: var(--color-primary);
  color: var(--color-text-inverse);
}
</style>
