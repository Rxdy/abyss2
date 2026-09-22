<script setup>
/*
 * Sélecteur de mois : précédent / suivant, avec des bornes (aucun mois avant la
 * plus ancienne transaction, aucun mois futur) et un raccourci vers le mois courant.
 * v-model = 'yyyy-mm'.
 */
import { computed } from 'vue'
import BaseButton from '@/components/atoms/BaseButton.vue'
import BaseIcon   from '@/components/atoms/BaseIcon.vue'
import BaseText   from '@/components/atoms/BaseText.vue'
import IconButton from '@/components/atoms/IconButton.vue'
import { formatMonth } from '@/utils/format.js'
import { shiftMonth } from '@/utils/period.js'

const props = defineProps({
  /** Plus ancien mois affiché ('' : pas de borne) */
  min: { type: String, default: '' },
  /** Mois courant : le plus récent affichable ('' : pas de borne) */
  max: { type: String, default: '' },
})

const month = defineModel({ type: String, required: true })

const canGoBack    = computed(() => !props.min || month.value > props.min)
const canGoForward = computed(() => !props.max || month.value < props.max)
const isCurrent    = computed(() => !props.max || month.value === props.max)

const label = computed(() => {
  const text = formatMonth(month.value)
  return text.charAt(0).toUpperCase() + text.slice(1)
})
</script>

<template>
  <div class="month-nav" role="group" aria-label="Choisir le mois">
    <IconButton label="Mois précédent" :disabled="!canGoBack" @click="month = shiftMonth(month, -1)">
      <BaseIcon name="chevron" :size="16" class="month-nav__prev" />
    </IconButton>

    <div class="month-nav__label">
      <BaseText as="span" size="sm" weight="semibold" color="primary" aria-live="polite">{{ label }}</BaseText>
      <BaseButton v-if="!isCurrent" variant="ghost" size="sm" @click="month = max">Mois en cours</BaseButton>
    </div>

    <IconButton label="Mois suivant" :disabled="!canGoForward" @click="month = shiftMonth(month, 1)">
      <BaseIcon name="chevron" :size="16" />
    </IconButton>
  </div>
</template>

<style scoped>
.month-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.month-nav__label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.month-nav__prev { transform: rotate(180deg); }
</style>
