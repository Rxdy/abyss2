/**
 * Tests composant — CategoryDoughnutChart (Chart.js remplacé : happy-dom n'a pas de canvas)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

const { instances } = vi.hoisted(() => ({ instances: [] }))

vi.mock('chart.js', () => {
  class Chart {
    static register = vi.fn()
    constructor(canvas, config) {
      Object.assign(this, { canvas, config, data: config.data, options: config.options })
      this.update  = vi.fn()
      this.destroy = vi.fn()
      instances.push(this)
    }
  }
  return { Chart, ArcElement: {}, DoughnutController: {}, Tooltip: {} }
})

import CategoryDoughnutChart from '@/components/molecules/CategoryDoughnutChart.vue'

const FOOD = {
  id: 'food', name: 'Alimentation', color: '#4ade80', amount: 30000, percentage: 60,
  children: [
    { id: 'resto', name: 'Restaurants', color: null, amount: 10000, percentage: 33.3 },
    { id: 'courses', name: 'Courses', color: '#86efac', amount: 15000, percentage: 50 },
  ],
}
const TRANSPORT = { id: 'transport', name: 'Transport', color: '#38bdf8', amount: 20000, percentage: 40, children: [] }

let wrapper
const mountChart = (props = {}) => (wrapper = mount(CategoryDoughnutChart, { props: { categories: [FOOD, TRANSPORT], total: 50000, ...props } }))
const chart = () => instances.at(-1)

beforeEach(() => { instances.length = 0 })
afterEach(() => wrapper?.unmount())

describe('CategoryDoughnutChart — construction', () => {
  it('crée un camembert (doughnut) sur le canvas', () => {
    mountChart()

    expect(instances).toHaveLength(1)
    expect(chart().config.type).toBe('doughnut')
    expect(chart().canvas).toBe(wrapper.find('canvas').element)
  })

  it('une catégorie sans sous-catégorie donne une part', () => {
    mountChart({ categories: [TRANSPORT], total: 20000 })

    expect(chart().data.labels).toEqual(['Transport'])
    expect(chart().data.datasets[0].data).toEqual([20000])
  })

  it('aplatit la hiérarchie : sous-catégories + reste de la parente, jamais les deux niveaux', () => {
    mountChart({ categories: [FOOD], total: 30000 })

    const { labels, datasets: [{ data }] } = chart().data
    // 30000 = 15000 (Courses) + 10000 (Restaurants) + 5000 (reste d'Alimentation)
    expect(labels).toEqual(['Alimentation · Courses', 'Alimentation · Restaurants', 'Alimentation'])
    expect(data).toEqual([15000, 10000, 5000])
    expect(data.reduce((a, b) => a + b, 0)).toBe(FOOD.amount)
  })

  it('pas de part « reste » quand les sous-catégories couvrent tout le montant', () => {
    const full = { ...FOOD, amount: 25000 }
    mountChart({ categories: [full], total: 25000 })

    expect(chart().data.labels).toEqual(['Alimentation · Courses', 'Alimentation · Restaurants'])
  })

  it('trie les parts par montant décroissant', () => {
    mountChart()

    const data = chart().data.datasets[0].data
    expect(data).toEqual([...data].sort((a, b) => b - a))
  })

  it('une sous-catégorie sans couleur reprend celle de sa parente', () => {
    mountChart({ categories: [FOOD], total: 30000 })

    const { labels, datasets: [{ backgroundColor }] } = chart().data
    expect(backgroundColor[labels.indexOf('Alimentation · Restaurants')]).toBe('#4ade80')
    expect(backgroundColor[labels.indexOf('Alimentation · Courses')]).toBe('#86efac')
  })

  it('masque la légende native (le détail est dans la liste)', () => {
    mountChart()

    expect(chart().options.plugins.legend.display).toBe(false)
  })
})

describe('CategoryDoughnutChart — infobulle', () => {
  const tooltip = () => chart().options.plugins.tooltip.callbacks

  it('nomme la part survolée, sous-catégories comprises', () => {
    mountChart({ categories: [FOOD, TRANSPORT], total: 50000 })
    const { labels } = chart().data

    for (const [index, name] of labels.entries()) {
      expect(tooltip().title([{ dataIndex: index }])).toBe(name)
    }
  })

  it('donne le montant et la part de CETTE part du camembert', () => {
    mountChart({ categories: [FOOD, TRANSPORT], total: 50000 })
    const index = chart().data.labels.indexOf('Alimentation · Courses')

    expect(tooltip().label({ dataIndex: index })).toMatch(/150,00\s€ · 30%/)
  })

  it('la part « reste » d\'une parente porte le montant qui reste, pas celui de la catégorie entière', () => {
    mountChart({ categories: [FOOD], total: 30000 })
    const index = chart().data.labels.indexOf('Alimentation')

    expect(tooltip().label({ dataIndex: index })).toMatch(/50,00\s€ · 16\.7%/)
  })

  it('total nul : 0 % plutôt que NaN', () => {
    mountChart({ categories: [TRANSPORT], total: 0 })

    expect(tooltip().label({ dataIndex: 0 })).toMatch(/ · 0%/)
  })
})

describe('CategoryDoughnutChart — cycle de vie', () => {
  it('redessine le même graphique quand les données changent', async () => {
    mountChart({ categories: [TRANSPORT], total: 20000 })

    await wrapper.setProps({ categories: [FOOD, TRANSPORT], total: 50000 })

    expect(instances).toHaveLength(1)
    expect(chart().update).toHaveBeenCalled()
    expect(chart().data.labels).toContain('Alimentation · Courses')
  })

  it('redessine au changement de thème', async () => {
    mountChart()
    const before = chart().update.mock.calls.length

    document.documentElement.setAttribute('data-theme', 'light')
    await new Promise((resolve) => setTimeout(resolve, 10))
    await nextTick()

    expect(chart().update.mock.calls.length).toBeGreaterThan(before)
  })

  it('une part hors liste ne fait pas planter l\'infobulle', () => {
    mountChart()

    expect(chart().options.plugins.tooltip.callbacks.label({ dataIndex: 99 })).toBe('')
    expect(chart().options.plugins.tooltip.callbacks.title([{ dataIndex: 99 }])).toBe('')
  })

  it('détruit le graphique au démontage', () => {
    mountChart()
    const instance = chart()

    wrapper.unmount()
    wrapper = null

    expect(instance.destroy).toHaveBeenCalledOnce()
  })

  it('décrit le graphique aux lecteurs d\'écran', () => {
    mountChart()

    expect(wrapper.find('[role="img"]').attributes('aria-label'))
      .toBe('Répartition par catégorie : Alimentation 60%, Transport 40%')
  })
})
