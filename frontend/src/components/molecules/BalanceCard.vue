<script setup>
import { computed } from 'vue'
import BaseText from '@/components/atoms/BaseText.vue'
import { formatAmount, formatMonth } from '@/utils/format.js'

const props = defineProps({
  balance:      { type: Number, default: 0 },
  monthIncome:  { type: Number, default: 0 },
  monthExpense: { type: Number, default: 0 },
  month:        { type: String, default: '' },
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

    <BaseText v-if="month" as="p" size="xs" color="muted">
      Mois en cours — {{ formatMonth(month) }}
    </BaseText>
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

.balance__month {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  margin-top: var(--space-2);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
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
