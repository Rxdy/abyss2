<script setup>
import { computed } from 'vue'
import BaseText from '@/components/atoms/BaseText.vue'
import { formatAmount } from '@/utils/format.js'

const props = defineProps({
  balance:      { type: Number, default: 0 },
  monthIncome:  { type: Number, default: 0 },
  monthExpense: { type: Number, default: 0 },
})

const isNegative = computed(() => props.balance < 0)
</script>

<template>
  <section class="balance" aria-labelledby="balance-title">
    <BaseText id="balance-title" as="p" size="xs" color="muted">Solde</BaseText>

    <BaseText
      as="p"
      size="3xl"
      weight="bold"
      :color="isNegative ? 'danger' : 'primary'"
      class="balance__amount"
    >
      {{ formatAmount(balance) }}
    </BaseText>

    <!-- Le solde est global ; ce qui suit concerne le mois affiché (sélecteur fourni par la page) -->
    <div class="balance__period">
      <slot name="month" />

      <div class="balance__month">
        <div class="balance__stat">
          <span class="balance__dot balance__dot--income" aria-hidden="true" />
          <div>
            <BaseText as="p" size="xs" color="muted">Revenus</BaseText>
            <BaseText as="p" size="sm" weight="semibold" color="success">
              {{ formatAmount(monthIncome) }}
            </BaseText>
          </div>
        </div>

        <div class="balance__stat">
          <span class="balance__dot balance__dot--expense" aria-hidden="true" />
          <div>
            <BaseText as="p" size="xs" color="muted">Dépenses</BaseText>
            <BaseText as="p" size="sm" weight="semibold" color="danger">
              {{ formatAmount(monthExpense) }}
            </BaseText>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.balance {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-5);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
}

.balance__amount {
  font-variant-numeric: tabular-nums;
  line-height: var(--leading-tight);
}

.balance__period {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  margin-top: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.balance__month {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.balance__stat {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.balance__dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.balance__dot--income  { background: var(--color-success); }
.balance__dot--expense { background: var(--color-danger); }
</style>
