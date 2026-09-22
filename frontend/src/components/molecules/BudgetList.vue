<script setup>
/*
 * Jauges de budget : pour chaque catégorie, ce qui est dépensé sur le plafond du
 * mois. Vert tant qu'on est large, jaune à partir de 80 %, rouge une fois dépassé.
 * Reçoit des lignes prêtes (utils/budget.js → buildBudgets).
 */
import BaseText from '@/components/atoms/BaseText.vue'
import { formatAmount } from '@/utils/format.js'

defineProps({
  // [{ id, name, color, budget, spent, percent, status: 'ok' | 'warn' | 'over', remaining }]
  budgets: { type: Array, required: true },
})

const summary = (b) =>
  `${formatAmount(b.spent)} sur ${formatAmount(b.budget)}` +
  (b.status === 'over' ? `, dépassé de ${formatAmount(-b.remaining)}` : `, il reste ${formatAmount(b.remaining)}`)
</script>

<template>
  <ul class="budgets">
    <li v-for="budget in budgets" :key="budget.id" class="budget">
      <div class="budget__head">
        <span class="budget__color" :style="{ background: budget.color ?? 'var(--color-text-muted)' }" aria-hidden="true" />
        <BaseText size="sm" color="primary" truncate class="budget__name">{{ budget.name }}</BaseText>
        <BaseText size="xs" color="muted" class="budget__amounts">
          {{ formatAmount(budget.spent) }} / {{ formatAmount(budget.budget) }}
        </BaseText>
      </div>

      <div
        class="budget__bar"
        role="meter"
        :aria-label="`Budget ${budget.name}`"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.min(budget.percent, 100)"
        :aria-valuetext="summary(budget)"
      >
        <span class="budget__fill" :class="`budget__fill--${budget.status}`" :style="{ width: `${Math.min(budget.percent, 100)}%` }" />
      </div>

      <BaseText
        size="xs"
        :color="budget.status === 'over' ? 'danger' : 'muted'"
        class="budget__remaining"
      >
        <template v-if="budget.status === 'over'">Dépassé de {{ formatAmount(-budget.remaining) }}</template>
        <template v-else>Reste {{ formatAmount(budget.remaining) }}</template>
      </BaseText>
    </li>
  </ul>
</template>

<style scoped>
.budgets {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.budget {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.budget__head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.budget__color {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.budget__name { flex: 1; min-width: 0; }
.budget__amounts { font-variant-numeric: tabular-nums; white-space: nowrap; }
.budget__remaining { font-variant-numeric: tabular-nums; }

.budget__bar {
  height: 0.5rem;
  border-radius: var(--radius-full);
  background: var(--color-bg-elevated);
  overflow: hidden;
}

.budget__fill {
  display: block;
  height: 100%;
  border-radius: var(--radius-full);
  transition: width var(--transition-normal);
}

.budget__fill--ok   { background: var(--strength-4); }
.budget__fill--warn { background: var(--strength-2); }
.budget__fill--over { background: var(--strength-0); }
</style>
