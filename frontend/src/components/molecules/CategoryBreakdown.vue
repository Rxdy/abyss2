<script setup>
/*
 * Détail par catégorie : montant, part du total et barre de progression,
 * avec les sous-catégories en retrait.
 */
import BaseText from '@/components/atoms/BaseText.vue'
import { formatAmount } from '@/utils/format.js'

defineProps({
  // [{ id, name, color, amount, percentage, children: [{ id, name, color, amount, percentage }] }]
  categories: { type: Array, required: true },
})
</script>

<template>
  <ul class="breakdown">
    <li v-for="category in categories" :key="category.id ?? 'none'" class="category-stat">
      <div class="category-stat__row">
        <span class="category-stat__color" :style="{ background: category.color ?? 'var(--color-text-muted)' }" aria-hidden="true" />
        <BaseText size="sm" color="primary" truncate class="category-stat__name">{{ category.name }}</BaseText>
        <BaseText size="sm" weight="semibold" color="primary" class="category-stat__amount">
          {{ formatAmount(category.amount) }}
        </BaseText>
        <BaseText size="xs" color="muted" class="category-stat__pct">{{ category.percentage }}%</BaseText>
      </div>
      <div class="bar-track" role="img" :aria-label="`${category.name} : ${category.percentage}% du total`">
        <div class="bar-fill" :style="{ width: category.percentage + '%', background: category.color ?? 'var(--color-text-muted)' }" />
      </div>

      <ul v-if="category.children.length" class="category-stat__children">
        <li v-for="child in category.children" :key="child.id" class="child-stat">
          <div class="category-stat__row">
            <span class="category-stat__color category-stat__color--sm" :style="{ background: child.color ?? 'var(--color-text-muted)' }" aria-hidden="true" />
            <BaseText size="xs" color="secondary" truncate class="category-stat__name">{{ child.name }}</BaseText>
            <BaseText size="xs" color="secondary" class="category-stat__amount">{{ formatAmount(child.amount) }}</BaseText>
            <BaseText size="xs" color="muted" class="category-stat__pct">{{ child.percentage }}%</BaseText>
          </div>
          <div class="bar-track bar-track--sm" role="img" :aria-label="`${child.name} : ${child.percentage}% de ${category.name}`">
            <div class="bar-fill" :style="{ width: child.percentage + '%', background: child.color ?? 'var(--color-text-muted)' }" />
          </div>
        </li>
      </ul>
    </li>
  </ul>
</template>

<style scoped>
.breakdown {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.category-stat {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.category-stat__row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.category-stat__color {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.category-stat__color--sm { width: 7px; height: 7px; }

.category-stat__name { flex: 1; min-width: 0; }

.category-stat__amount { font-variant-numeric: tabular-nums; white-space: nowrap; }
.category-stat__pct {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  min-width: 3ch;
  text-align: right;
}

.bar-track {
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-bg-elevated);
  overflow: hidden;
}

.bar-track--sm { height: 5px; }

.bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width var(--transition-normal);
}

.category-stat__children {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-left: var(--space-6);
  margin-top: var(--space-1);
}

.child-stat {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
</style>
