<script setup>
/*
 * Filtres de la page Statistiques : type (dépenses / revenus), vue (mois /
 * année / personnalisé) et la période correspondante. Ne fait aucun appel :
 * les valeurs vivent dans la page, qui recharge quand elles changent.
 */
import BaseChip   from '@/components/atoms/BaseChip.vue'
import BaseInput  from '@/components/atoms/BaseInput.vue'
import BaseSelect from '@/components/atoms/BaseSelect.vue'
import BaseText   from '@/components/atoms/BaseText.vue'
import { formatMonth } from '@/utils/format.js'

defineProps({
  monthOptions: { type: Array, default: () => [] }, // ['2026-09', '2026-08', …]
  yearOptions:  { type: Array, default: () => [] }, // ['2026', '2025', …]
})

const type  = defineModel('type',  { type: String, default: 'expense' }) // 'expense' | 'income'
const view  = defineModel('view',  { type: String, default: 'month' })   // 'month' | 'year' | 'custom'
const month = defineModel('month', { type: String, default: '' })
const year  = defineModel('year',  { type: String, default: '' })
const from  = defineModel('from',  { type: String, default: '' })
const to    = defineModel('to',    { type: String, default: '' })

const VIEWS = [
  { value: 'month',  label: 'Mois' },
  { value: 'year',   label: 'Année' },
  { value: 'custom', label: 'Personnalisé' },
]

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1)
}
</script>

<template>
  <div class="stats-filters">
    <div class="stats-filters__group" role="group" aria-label="Type">
      <BaseChip :active="type === 'expense'" @click="type = 'expense'">Dépenses</BaseChip>
      <BaseChip :active="type === 'income'" @click="type = 'income'">Revenus</BaseChip>
    </div>

    <div class="stats-filters__group" role="group" aria-label="Vue">
      <BaseChip
        v-for="option in VIEWS"
        :key="option.value"
        :active="view === option.value"
        @click="view = option.value"
      >
        {{ option.label }}
      </BaseChip>
    </div>

    <div v-if="view === 'month'" class="stats-filters__select">
      <BaseSelect v-model="month" size="sm" aria-label="Mois">
        <option v-for="m in monthOptions" :key="m" :value="m">{{ capitalize(formatMonth(m)) }}</option>
      </BaseSelect>
    </div>

    <div v-if="view === 'year'" class="stats-filters__select">
      <BaseSelect v-model="year" size="sm" aria-label="Année">
        <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}</option>
      </BaseSelect>
    </div>

    <div v-if="view === 'custom'" class="stats-filters__dates">
      <BaseInput v-model="from" type="date" size="sm" label="Depuis le" hide-label :max="to" />
      <BaseText size="sm" color="muted">→</BaseText>
      <BaseInput v-model="to" type="date" size="sm" label="Jusqu'au" hide-label :min="from" />
    </div>
  </div>
</template>

<style scoped>
.stats-filters {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.stats-filters__group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.stats-filters__dates {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.stats-filters__select {
  align-self: flex-start;
}
</style>
