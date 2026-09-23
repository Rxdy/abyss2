/**
 * Tests composant — TimeseriesChart (Chart.js remplacé : happy-dom n'a pas de canvas)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'

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
  return {
    Chart, CategoryScale: {}, Filler: {}, LinearScale: {}, LineController: {}, LineElement: {}, PointElement: {}, Tooltip: {},
  }
})

import TimeseriesChart from '@/components/molecules/TimeseriesChart.vue'

const DAILY   = [{ date: '2026-09-01', amount: 1250 }, { date: '2026-09-02', amount: 0 }, { date: '2026-09-03', amount: 30000 }]
const MONTHLY = [{ date: '2026-07', amount: 100000 }, { date: '2026-08', amount: 80000 }]

let wrapper
const mountChart = (props = {}) => (wrapper = mount(TimeseriesChart, { props: { timeseries: DAILY, ...props } }))
const chart = () => instances.at(-1)
const dataset = () => chart().data.datasets[0]

beforeEach(() => {
  instances.length = 0
  document.documentElement.style.setProperty('--color-danger', '#f87171')
  document.documentElement.style.setProperty('--color-success', '#4dde93')
})
afterEach(() => wrapper?.unmount())

describe('TimeseriesChart — construction', () => {
  it('crée une courbe (line) sur le canvas', () => {
    mountChart()

    expect(instances).toHaveLength(1)
    expect(chart().config.type).toBe('line')
    expect(chart().canvas).toBe(wrapper.find('canvas').element)
  })

  it('convertit les centimes en euros', () => {
    mountChart()

    expect(dataset().data).toEqual([12.5, 0, 300])
  })

  it('un point par jour : libellés courts', () => {
    mountChart()

    expect(chart().data.labels).toHaveLength(3)
    expect(chart().data.labels[0]).toMatch(/1\S*\s+sept/)
  })

  it('un point par mois quand la clé est « YYYY-MM » : mois et année', () => {
    mountChart({ timeseries: MONTHLY })

    expect(chart().data.labels[0]).toMatch(/juil\.?\s+26/)
    expect(chart().data.labels[1]).toMatch(/août\s+26/)
  })

  it('une dépense est rouge, un revenu vert', () => {
    mountChart()
    expect(dataset().borderColor).toBe('#f87171')

    wrapper.unmount()
    mountChart({ type: 'income' })
    expect(dataset().borderColor).toBe('#4dde93')
  })

  it('l\'axe des ordonnées part de zéro, sans légende', () => {
    mountChart()

    expect(chart().options.scales.y.beginAtZero).toBe(true)
    expect(chart().options.plugins.legend.display).toBe(false)
  })
})

describe('TimeseriesChart — formats', () => {
  it('graduations de l\'axe : montants en euros', () => {
    mountChart()

    expect(chart().options.scales.y.ticks.callback(12.5)).toMatch(/12,50\s€/)
  })

  it('infobulle : titre = date du point, corps = montant', () => {
    mountChart()
    const { title, label } = chart().options.plugins.tooltip.callbacks

    expect(title([{ dataIndex: 2 }])).toBe(chart().data.labels[2])
    expect(label({ raw: 300 })).toMatch(/300,00\s€/)
  })
})

describe('TimeseriesChart — cycle de vie', () => {
  it('redessine le même graphique quand la série change', async () => {
    mountChart()

    await wrapper.setProps({ timeseries: MONTHLY })

    expect(instances).toHaveLength(1)
    expect(chart().update).toHaveBeenCalled()
    expect(dataset().data).toEqual([1000, 800])
  })

  it('redessine quand on passe de dépenses à revenus', async () => {
    mountChart()

    await wrapper.setProps({ type: 'income' })

    expect(chart().update).toHaveBeenCalled()
    expect(dataset().borderColor).toBe('#4dde93')
  })

  it('détruit le graphique au démontage', () => {
    mountChart()
    const instance = chart()

    wrapper.unmount()
    wrapper = null

    expect(instance.destroy).toHaveBeenCalledOnce()
  })

  it('est décrit aux lecteurs d\'écran', () => {
    mountChart()

    expect(wrapper.find('[role="img"]').attributes('aria-label')).toBe('Évolution du montant sur la période')
  })
})
