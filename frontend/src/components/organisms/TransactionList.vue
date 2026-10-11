<script setup>
import TransactionItem from '@/components/molecules/TransactionItem.vue'
import BaseText from '@/components/atoms/BaseText.vue'

defineProps({
  transactions: { type: Array, default: () => [] },
  loading:      { type: Boolean, default: false },
  emptyLabel:   { type: String, default: 'Aucune transaction pour l\'instant.' },
  clickable:    { type: Boolean, default: false },
})

defineEmits(['select'])
</script>

<template>
  <div class="transaction-list">
    <!-- « Chargement… » seulement au premier chargement : en revenant sur la page, la liste déjà
         connue reste affichée pendant sa mise à jour au lieu de clignoter. -->
    <BaseText v-if="loading && transactions.length === 0" as="p" size="sm" color="muted" class="transaction-list__state">
      Chargement…
    </BaseText>

    <BaseText
      v-else-if="transactions.length === 0"
      as="p"
      size="sm"
      color="muted"
      class="transaction-list__state"
    >
      {{ emptyLabel }}
    </BaseText>

    <ul v-else class="transaction-list__items">
      <li v-for="transaction in transactions" :key="transaction.id">
        <TransactionItem
          :transaction="transaction"
          :clickable="clickable"
          @select="$emit('select', $event)"
        />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.transaction-list {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.transaction-list__state {
  padding: var(--space-6) var(--space-4);
  text-align: center;
}

.transaction-list__items > li + li {
  border-top: 1px solid var(--color-border);
}
</style>
