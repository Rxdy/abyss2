<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import BaseText  from '@/components/atoms/BaseText.vue'
import { useStatsStore } from '@/stores/stats.store.js'
import { formatAmount, todayISO } from '@/utils/format.js'

const stats = useStatsStore()

/** yyyy-mm-dd du premier jour du mois contenant `date`. */
function startOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10)
}
/** yyyy-mm-dd du dernier jour du mois contenant `date`. */
function endOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
}

const PRESETS = [
  {
    value: 'this-month',
    label: 'Ce mois-ci',
    range: () => { const d = new Date(); return { from: startOfMonth(d), to: endOfMonth(d) } },
  },
  {
    value: 'last-month',
    label: 'Mois dernier',
    range: () => {
      const d = new Date()
      const prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))
      return { from: startOfMonth(prev), to: endOfMonth(prev) }
    },
  },
  {
    value: 'this-year',
    label: 'Cette année',
    range: () => {
      const year = new Date().getUTCFullYear()
      return { from: `${year}-01-01`, to: `${year}-12-31` }
    },
  },
  { value: 'custom', label: 'Personnalisé', range: null },
]

const preset = ref('this-month')
const type   = ref('expense')
const customFrom = ref(startOfMonth(new Date()))
const customTo   = ref(todayISO())

const range = computed(() => {
  const found = PRESETS.find((p) => p.value === preset.value)
  return found?.range ? found.range() : { from: customFrom.value, to: customTo.value }
})

function load() {
  const { from, to } = range.value
  if (!from || !to) return
  stats.fetch({ from, to, type: type.value }).catch(() => {})
}

watch([preset, type, customFrom, customTo], load)
onMounted(load)

const isEmpty = computed(() => !stats.loading && stats.data.categories.length === 0)
</script>

<template>
  <section class="stats">
    <header class="stats__head">
      <BaseText as="h1" size="2xl" weight="bold" color="primary">Statistiques</BaseText>
      <BaseText as="p" size="sm" color="muted">
        Répartition par catégorie sur la période choisie.
      </BaseText>
    </header>

    <div class="stats__filters">
      <div class="stats__group" role="group" aria-label="Type">
        <button
          type="button"
          class="chip"
          :class="{ 'chip--active': type === 'expense' }"
          :aria-pressed="type === 'expense'"
          @click="type = 'expense'"
        >
          Dépenses
        </button>
        <button
          type="button"
          class="chip"
          :class="{ 'chip--active': type === 'income' }"
          :aria-pressed="type === 'income'"
          @click="type = 'income'"
        >
          Revenus
        </button>
      </div>

      <div class="stats__group" role="group" aria-label="Période">
        <button
          v-for="option in PRESETS"
          :key="option.value"
          type="button"
          class="chip"
          :class="{ 'chip--active': preset === option.value }"
          :aria-pressed="preset === option.value"
          @click="preset = option.value"
        >
          {{ option.label }}
        </button>
      </div>

      <div v-if="preset === 'custom'" class="stats__dates">
        <input type="date" v-model="customFrom" class="stats__date" aria-label="Depuis le" :max="customTo" />
        <BaseText size="sm" color="muted">→</BaseText>
        <input type="date" v-model="customTo" class="stats__date" aria-label="Jusqu'au" :min="customFrom" />
      </div>
    </div>

    <div v-if="stats.error" class="stats__error" role="alert">
      <BaseText size="sm" color="danger">{{ stats.error }}</BaseText>
    </div>

    <div class="stats__total">
      <BaseText size="xs" color="muted">Total {{ type === 'expense' ? 'dépenses' : 'revenus' }}</BaseText>
      <BaseText size="xl" weight="bold" :color="type === 'expense' ? 'danger' : 'success'">
        {{ formatAmount(stats.data.total) }}
      </BaseText>
    </div>

    <BaseText v-if="isEmpty" as="p" size="sm" color="muted">
      Aucune {{ type === 'expense' ? 'dépense' : 'revenu' }} sur cette période.
    </BaseText>

    <ul v-else class="stats__list">
      <li v-for="category in stats.data.categories" :key="category.id ?? 'none'" class="category-stat">
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
  </section>
</template>

<style scoped>
.stats {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 32rem;
  margin: 0 auto;
  width: 100%;
}

.stats__head {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.stats__filters {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.stats__group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.chip {
  padding: var(--space-2) var(--space-3);
  min-height: 2.25rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  transition: color var(--transition-fast), border-color var(--transition-fast),
              background var(--transition-fast);
}

.chip--active {
  border-color: var(--color-primary);
  background: var(--color-primary-subtle);
  color: var(--color-primary);
}

.stats__dates {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.stats__date {
  min-height: 2.25rem;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
  font-size: var(--text-sm);
}

.stats__error {
  background: var(--color-danger-subtle);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}

.stats__total {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4) var(--space-5);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.stats__list {
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
