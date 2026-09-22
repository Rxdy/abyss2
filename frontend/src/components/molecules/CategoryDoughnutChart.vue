<script setup>
/*
 * Camembert (doughnut) de répartition par catégorie — Chart.js.
 * Les couleurs viennent des catégories (déjà utilisées par les barres de
 * StatsPage) ; les teintes d'interface (tooltip, séparateurs) sont lues sur
 * les variables CSS pour rester cohérentes avec le thème clair/sombre.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArcElement, Chart, DoughnutController, Tooltip } from 'chart.js'
import { useDocumentTheme } from '@/composables/useDocumentTheme.js'
import { formatAmount } from '@/utils/format.js'

Chart.register(ArcElement, DoughnutController, Tooltip)

const props = defineProps({
  categories: { type: Array, required: true },
  total:      { type: Number, default: 0 },
})

const canvasEl = ref(null)
const theme = useDocumentTheme()
let chart = null

/** Couleur résolue d'une variable CSS — <canvas> ne sait pas lire un var() brut. */
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/**
 * Aplatit la hiérarchie catégorie → sous-catégories en parts de camembert :
 * chaque sous-catégorie devient sa propre part, et ce qui reste du montant
 * de la catégorie parente (non affecté à une sous-catégorie) en devient une
 * aussi — jamais les deux niveaux superposés, qui doubleraient le total.
 */
const leaves = computed(() => {
  const result = []
  for (const category of props.categories) {
    const children = category.children ?? []
    if (!children.length) {
      result.push({ name: category.name, amount: category.amount, color: category.color })
      continue
    }
    const childrenSum = children.reduce((sum, c) => sum + c.amount, 0)
    const ownAmount = category.amount - childrenSum
    if (ownAmount > 0) {
      result.push({ name: category.name, amount: ownAmount, color: category.color })
    }
    for (const child of children) {
      result.push({ name: `${category.name} · ${child.name}`, amount: child.amount, color: child.color ?? category.color })
    }
  }
  return result.sort((a, b) => b.amount - a.amount)
})

function pct(amount) {
  return props.total > 0 ? Math.round((amount / props.total) * 1000) / 10 : 0
}

function buildData() {
  const fallback = cssVar('--color-text-muted')
  return {
    labels: leaves.value.map((l) => l.name),
    datasets: [{
      data: leaves.value.map((l) => l.amount),
      backgroundColor: leaves.value.map((l) => l.color || fallback),
      borderColor: cssVar('--color-bg-surface'),
      borderWidth: 2,
      hoverOffset: 6,
    }],
  }
}

function buildOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '68%',
    animation: { duration: 400 },
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
          // Les parts sont les feuilles aplaties et triées, pas la liste des catégories : c'est elles qu'on relit.
          title: (items) => leaves.value[items[0].dataIndex]?.name ?? '',
          label: (item) => {
            const leaf = leaves.value[item.dataIndex]
            return leaf ? `${formatAmount(leaf.amount)} · ${pct(leaf.amount)}%` : ''
          },
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
    chart = new Chart(canvasEl.value, { type: 'doughnut', data: buildData(), options: buildOptions() })
  }
}

onMounted(render)
onBeforeUnmount(() => { chart?.destroy(); chart = null })

// Les couleurs de catégorie ne changent pas avec le thème, mais le tooltip
// et le liseré des parts si — on redessine dans les deux cas.
watch(() => props.categories, render, { deep: true })
watch(theme, render)
</script>

<template>
  <div
    class="doughnut"
    role="img"
    :aria-label="`Répartition par catégorie : ${categories.map((c) => `${c.name} ${c.percentage}%`).join(', ')}`"
  >
    <canvas ref="canvasEl"></canvas>
  </div>
</template>

<style scoped>
.doughnut {
  position: relative;
  height: 220px;
  width: 100%;
}
</style>
