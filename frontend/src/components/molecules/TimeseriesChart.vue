<script setup>
/*
 * Courbe d'évolution — montant (ordonnée) par date (abscisse), Chart.js.
 * Le backend choisit déjà le pas (jour ou mois) selon la longueur de la
 * période ; on le déduit ici de la longueur de la clé ('YYYY-MM-DD' vs
 * 'YYYY-MM') pour formater les libellés de l'axe et de l'infobulle.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  CategoryScale, Chart, Filler, LinearScale, LineController, LineElement, PointElement, Tooltip,
} from 'chart.js'
import { useDocumentTheme } from '@/composables/useDocumentTheme.js'
import { formatAmount, formatShortDate } from '@/utils/format.js'

Chart.register(CategoryScale, Filler, LinearScale, LineController, LineElement, PointElement, Tooltip)

const props = defineProps({
  timeseries: { type: Array, required: true }, // [{ date: 'YYYY-MM-DD' | 'YYYY-MM', amount }]
  type:       { type: String, default: 'expense' }, // pilote la couleur : dépense (rouge) vs revenu (vert)
})

const canvasEl = ref(null)
const theme = useDocumentTheme()
let chart = null

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

const monthShortFormat = new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' })

/** 'YYYY-MM-DD' → '05 sept.' · 'YYYY-MM' → 'sept. 26' */
function formatLabel(dateKey) {
  if (dateKey.length === 7) {
    const [y, m] = dateKey.split('-').map(Number)
    return monthShortFormat.format(new Date(Date.UTC(y, m - 1, 1)))
  }
  return formatShortDate(dateKey)
}

const accentName = computed(() => (props.type === 'income' ? 'success' : 'danger'))

function buildData() {
  const accent = cssVar(`--color-${accentName.value}`)
  const fill   = cssVar(`--color-${accentName.value}-subtle`)
  return {
    labels: props.timeseries.map((p) => formatLabel(p.date)),
    datasets: [{
      data: props.timeseries.map((p) => p.amount / 100),
      borderColor: accent,
      backgroundColor: fill,
      fill: true,
      tension: 0.3,
      borderWidth: 2,
      pointRadius: 0,
      pointHitRadius: 10,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: accent,
      pointHoverBorderWidth: 0,
    }],
  }
}

function buildOptions() {
  const gridColor = cssVar('--color-border')
  const textColor = cssVar('--color-text-muted')
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 400 },
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: textColor, maxRotation: 0, autoSkip: true, autoSkipPadding: 12 },
      },
      y: {
        beginAtZero: true,
        grid: { color: gridColor },
        border: { display: false },
        ticks: {
          color: textColor,
          callback: (value) => formatAmount(value * 100),
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: cssVar('--color-bg-elevated'),
        borderColor: cssVar('--color-border'),
        borderWidth: 1,
        titleColor: cssVar('--color-text-primary'),
        bodyColor: cssVar('--color-text-secondary'),
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          title: (items) => formatLabel(props.timeseries[items[0].dataIndex].date),
          label: (item) => formatAmount(item.raw * 100),
        },
      },
    },
  }
}

function render() {
  if (!canvasEl.value) return
  if (chart) {
    chart.data = buildData()
    chart.options = buildOptions()
    chart.update()
  } else {
    chart = new Chart(canvasEl.value, { type: 'line', data: buildData(), options: buildOptions() })
  }
}

onMounted(render)
onBeforeUnmount(() => { chart?.destroy(); chart = null })

watch(() => props.timeseries, render, { deep: true })
watch(() => props.type, render)
watch(theme, render)
</script>

<template>
  <div class="timeseries" role="img" aria-label="Évolution du montant sur la période">
    <canvas ref="canvasEl"></canvas>
  </div>
</template>

<style scoped>
.timeseries {
  position: relative;
  height: 200px;
  width: 100%;
}
</style>
