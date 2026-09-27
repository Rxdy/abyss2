<script setup>
import BaseText from '@/components/atoms/BaseText.vue'
import BaseIcon from '@/components/atoms/BaseIcon.vue'
import { formatSignedAmount, formatShortDate } from '@/utils/format.js'

defineProps({
  transaction: { type: Object, required: true },
  /** Rend la ligne cliquable (édition) */
  clickable:   { type: Boolean, default: false },
})

defineEmits(['select'])
</script>

<template>
  <component
    :is="clickable ? 'button' : 'div'"
    :type="clickable ? 'button' : undefined"
    class="transaction"
    :class="{ 'transaction--clickable': clickable }"
    @click="clickable && $emit('select', transaction)"
  >
    <span
      class="transaction__color"
      :style="{ background: transaction.category?.color ?? 'var(--color-text-muted)' }"
      aria-hidden="true"
    />

    <div class="transaction__body">
      <span class="transaction__title-row">
        <BaseText size="sm" weight="medium" color="primary" truncate>
          {{ transaction.title }}
        </BaseText>
        <BaseIcon
          v-if="transaction.recurringId"
          name="clock"
          :size="13"
          class="transaction__recurring-badge"
          title="Dépense/revenu fixe — générée automatiquement"
        />
      </span>
      <BaseText size="xs" color="muted">
        {{ formatShortDate(transaction.date) }}
        <template v-if="transaction.category"> · {{ transaction.category.name }}</template>
        <template v-if="transaction.recurringId"> · Fixe</template>
      </BaseText>
    </div>

    <BaseText
      size="sm"
      weight="semibold"
      :color="transaction.type === 'expense' ? 'danger' : 'success'"
      class="transaction__amount"
    >
      {{ formatSignedAmount(transaction.amount, transaction.type) }}
    </BaseText>
  </component>
</template>

<style scoped>
.transaction {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3) var(--space-4);
  text-align: left;
  background: transparent;
  border: none;
  color: inherit;
}

.transaction--clickable {
  cursor: pointer;
  transition: background var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}

.transaction--clickable:hover { background: var(--color-primary-subtle); }

.transaction__color {
  width: 4px;
  align-self: stretch;
  min-height: 2rem;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.transaction__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.transaction__title-row {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
}

.transaction__recurring-badge {
  flex-shrink: 0;
  color: var(--color-primary);
}

.transaction__amount {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
