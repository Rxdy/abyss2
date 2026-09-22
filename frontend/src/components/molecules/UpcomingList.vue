<script setup>
/*
 * Prochaines échéances des charges fixes : date, libellé, montant signé.
 */
import BaseText from '@/components/atoms/BaseText.vue'
import { formatShortDate, formatSignedAmount } from '@/utils/format.js'

defineProps({
  // [{ id, title, amount, type: 'expense' | 'income', nextDate: 'yyyy-mm-dd' }]
  items: { type: Array, required: true },
})
</script>

<template>
  <ul class="upcoming">
    <li v-for="item in items" :key="item.id" class="upcoming__item">
      <BaseText size="xs" color="muted" class="upcoming__date">{{ formatShortDate(item.nextDate) }}</BaseText>
      <BaseText size="sm" color="primary" truncate class="upcoming__title">{{ item.title }}</BaseText>
      <BaseText size="sm" weight="semibold" :color="item.type === 'expense' ? 'danger' : 'success'" class="upcoming__amount">
        {{ formatSignedAmount(item.amount, item.type) }}
      </BaseText>
    </li>
  </ul>
</template>

<style scoped>
.upcoming__item {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  padding: var(--space-2) 0;
}

.upcoming__item + .upcoming__item { border-top: 1px solid var(--color-border); }

.upcoming__date   { min-width: 3.75rem; white-space: nowrap; }
.upcoming__title  { flex: 1; min-width: 0; }
.upcoming__amount { font-variant-numeric: tabular-nums; white-space: nowrap; }
</style>
