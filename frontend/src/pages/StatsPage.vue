<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import BaseText  from '@/components/atoms/BaseText.vue'
import CategoryDoughnutChart from '@/components/molecules/CategoryDoughnutChart.vue'
import TimeseriesChart from '@/components/molecules/TimeseriesChart.vue'
import AlertBanner from '@/components/molecules/AlertBanner.vue'
import TrendBadge from '@/components/molecules/TrendBadge.vue'
import CategoryBreakdown from '@/components/molecules/CategoryBreakdown.vue'
import StatsFilters from '@/components/molecules/StatsFilters.vue'
import { useStatsStore } from '@/stores/stats.store.js'
import { formatAmount, todayISO } from '@/utils/format.js'
import { compareTotals, previousPeriod } from '@/utils/period.js'

const stats = useStatsStore()

/** yyyy-mm-dd du premier jour du mois contenant `date`. */
function startOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10)
}
/** yyyy-mm-dd du dernier jour du mois contenant `date`. */
function endOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
}

/* Minuit UTC du jour local : les getUTC* ci-dessous lisent alors la date de l'appareil, pas celle d'UTC. */
const now = new Date(`${todayISO()}T00:00:00Z`)
const currentMonthKey = startOfMonth(now).slice(0, 7)
const currentYearKey  = String(now.getUTCFullYear())

const view  = ref('month')
const type  = ref('expense')

const selectedMonth = ref(currentMonthKey)
const selectedYear  = ref(currentYearKey)
const customFrom = ref(startOfMonth(now))
const customTo   = ref(todayISO())

/* Le mois/l'année courant·e reste toujours sélectionnable, même sans transaction dessus. */
const monthOptions = computed(() => [...new Set([currentMonthKey, ...stats.periods.months])].sort().reverse())
const yearOptions  = computed(() => [...new Set([currentYearKey, ...stats.periods.years])].sort().reverse())

const range = computed(() => {
  if (view.value === 'year') {
    return { from: `${selectedYear.value}-01-01`, to: `${selectedYear.value}-12-31` }
  }
  if (view.value === 'custom') {
    return { from: customFrom.value, to: customTo.value }
  }
  const [y, m] = selectedMonth.value.split('-').map(Number)
  const monthDate = new Date(Date.UTC(y, m - 1, 1))
  return { from: startOfMonth(monthDate), to: endOfMonth(monthDate) }
})

/** La période à laquelle on compare, et son libellé (« août 2026 », « août, au 21 »…). */
const comparison = computed(() => {
  const { from, to } = range.value
  if (!from || !to || to < from) return null
  return previousPeriod({ view: view.value, from, to, today: todayISO() })
})

/** Écart entre la période affichée et la précédente ; null tant que la précédente n'est pas connue. */
const trend = computed(() => {
  if (!stats.previous || stats.loading) return null
  return compareTotals(stats.data.total, stats.previous.total, type.value)
})

function load() {
  const { from, to } = range.value
  if (!from || !to) return
  stats.fetch({ from, to, type: type.value }).catch(() => {})
  if (comparison.value) stats.fetchPrevious({ from: comparison.value.from, to: comparison.value.to, type: type.value })
}

/** Recharge la liste des mois/années disponibles pour le type courant, et recale la sélection si besoin. */
async function loadPeriods() {
  await stats.fetchPeriods({ type: type.value })
  if (!monthOptions.value.includes(selectedMonth.value)) selectedMonth.value = monthOptions.value[0]
  if (!yearOptions.value.includes(selectedYear.value)) selectedYear.value = yearOptions.value[0]
}

watch(type, () => { loadPeriods().then(load) })
watch([view, selectedMonth, selectedYear, customFrom, customTo], load)
onMounted(() => { loadPeriods().then(load) })

const isEmpty = computed(() => !stats.loading && stats.data.categories.length === 0)
</script>

<template>
  <section class="stats">
    <header class="stats__head">
      <BaseText as="h1" size="2xl" weight="bold" color="primary">Statistiques</BaseText>
    </header>

    <StatsFilters
      v-model:type="type"
      v-model:view="view"
      v-model:month="selectedMonth"
      v-model:year="selectedYear"
      v-model:from="customFrom"
      v-model:to="customTo"
      :month-options="monthOptions"
      :year-options="yearOptions"
    />

    <AlertBanner v-if="stats.error">{{ stats.error }}</AlertBanner>

    <div class="stats__total">
      <BaseText size="xs" color="muted">Total {{ type === 'expense' ? 'dépenses' : 'revenus' }}</BaseText>
      <BaseText size="xl" weight="bold" :color="type === 'expense' ? 'danger' : 'success'">
        {{ formatAmount(stats.data.total) }}
      </BaseText>
      <TrendBadge
        v-if="trend && comparison && (stats.data.total > 0 || stats.previous.total > 0)"
        :percent="trend.percent"
        :direction="trend.direction"
        :tone="trend.tone"
        :label="comparison.label"
      />
    </div>

    <BaseText v-if="isEmpty" as="p" size="sm" color="muted">
      Aucune {{ type === 'expense' ? 'dépense' : 'revenu' }} sur cette période.
    </BaseText>

    <div v-if="!isEmpty" class="stats__body">
      <div class="stats__charts">
        <TimeseriesChart :timeseries="stats.data.timeseries" :type="type" />
        <CategoryDoughnutChart :categories="stats.data.categories" :total="stats.data.total" />
      </div>

      <CategoryBreakdown :categories="stats.data.categories" />
    </div>
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

.stats__total {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4) var(--space-5);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.stats__body,
.stats__charts {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

/* Ordinateur : graphiques à gauche, détail par catégorie à droite. */
@media (min-width: 1024px) {
  .stats { max-width: 64rem; }

  .stats__body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--space-6);
    align-items: start;
  }
}
</style>
