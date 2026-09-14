<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import BaseIcon from '@/components/atoms/BaseIcon.vue'
import BaseText from '@/components/atoms/BaseText.vue'
import { formatShortDate } from '@/utils/format.js'

/**
 * Un seul contrôle pour choisir un intervalle de dates (au lieu de deux
 * champs séparés dans la barre de filtres) : un bouton résumant la
 * période, qui déplie un petit panneau avec « Du » / « Au ».
 */
const props = defineProps({
  from: { type: String, default: '' },
  to:   { type: String, default: '' },
})

const emit = defineEmits(['change'])

const root = ref(null)
const open = ref(false)
const localFrom = ref(props.from)
const localTo   = ref(props.to)

watch(() => [props.from, props.to], ([from, to]) => {
  localFrom.value = from
  localTo.value = to
})

const label = computed(() => {
  if (localFrom.value && localTo.value) return `${formatShortDate(localFrom.value)} → ${formatShortDate(localTo.value)}`
  if (localFrom.value) return `Depuis le ${formatShortDate(localFrom.value)}`
  if (localTo.value) return `Jusqu'au ${formatShortDate(localTo.value)}`
  return 'Toutes les dates'
})

const hasRange = computed(() => !!(localFrom.value || localTo.value))

function toggle() {
  open.value = !open.value
}

function apply() {
  emit('change', { from: localFrom.value, to: localTo.value })
}

function onFrom(event) {
  localFrom.value = event.target.value
  apply()
}

function onTo(event) {
  localTo.value = event.target.value
  apply()
}

function reset() {
  localFrom.value = ''
  localTo.value = ''
  apply()
}

function onClickOutside(event) {
  if (open.value && root.value && !root.value.contains(event.target)) open.value = false
}

function onKeydown(event) {
  if (event.key === 'Escape') open.value = false
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeydown)
  } else {
    document.removeEventListener('mousedown', onClickOutside)
    document.removeEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="date-range">
    <button
      type="button"
      class="date-range__trigger"
      :class="{ 'date-range__trigger--active': hasRange }"
      :aria-expanded="open"
      aria-haspopup="dialog"
      @click="toggle"
    >
      <BaseIcon name="calendar" :size="15" />
      <span class="date-range__label">{{ label }}</span>
    </button>

    <div v-if="open" class="date-range__panel" role="dialog" aria-label="Choisir une période">
      <div class="date-range__field">
        <label class="date-range__field-label" for="date-range-from">Du</label>
        <input
          id="date-range-from"
          type="date"
          class="date-range__input"
          :value="localFrom"
          :max="localTo || undefined"
          @change="onFrom"
        />
      </div>
      <div class="date-range__field">
        <label class="date-range__field-label" for="date-range-to">Au</label>
        <input
          id="date-range-to"
          type="date"
          class="date-range__input"
          :value="localTo"
          :min="localFrom || undefined"
          @change="onTo"
        />
      </div>

      <button v-if="hasRange" type="button" class="date-range__reset" @click="reset">
        <BaseText size="xs" color="danger">Réinitialiser la période</BaseText>
      </button>
    </div>
  </div>
</template>

<style scoped>
.date-range {
  position: relative;
}

.date-range__trigger {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  min-height: 2.25rem;
  max-width: 100%;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  transition: color var(--transition-fast), border-color var(--transition-fast),
              background var(--transition-fast);
}

.date-range__trigger--active {
  border-color: var(--color-primary);
  background: var(--color-primary-subtle);
  color: var(--color-primary);
}

.date-range__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.date-range__panel {
  position: absolute;
  z-index: 20;
  top: calc(100% + var(--space-2));
  left: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: max-content;
  max-width: min(20rem, 90vw);
  padding: var(--space-4);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

/* Mobile : quelle que soit la position du bouton dans la barre de filtres
   (qui wrap), un panneau ancré à son bord gauche peut déborder de l'écran.
   On bascule en feuille fixée en bas, au-dessus de la navbar. */
@media (max-width: 640px) {
  .date-range__panel {
    position: fixed;
    z-index: 100;
    top: auto;
    left: var(--space-4);
    right: var(--space-4);
    bottom: calc(var(--navbar-height) + var(--space-4) + env(safe-area-inset-bottom));
    width: auto;
    max-width: none;
  }
}

.date-range__field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.date-range__field-label {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.date-range__input {
  min-height: 2.5rem;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  font-size: var(--text-sm);
}

.date-range__reset {
  text-align: left;
  padding: var(--space-1) 0;
}
</style>
