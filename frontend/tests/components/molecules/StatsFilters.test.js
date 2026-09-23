/**
 * Tests composant — StatsFilters
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StatsFilters from '@/components/molecules/StatsFilters.vue'

const base = {
  type: 'expense', view: 'month', month: '2026-09', year: '2026',
  from: '2026-09-01', to: '2026-09-21',
  monthOptions: ['2026-09', '2026-08'], yearOptions: ['2026', '2025'],
}

const mountFilters = (props = {}) => mount(StatsFilters, { props: { ...base, ...props } })
const chip = (w, label) => w.findAll('button').find((b) => b.text() === label)

describe('StatsFilters', () => {
  it('propose type et vue', () => {
    const w = mountFilters()

    for (const label of ['Dépenses', 'Revenus', 'Mois', 'Année', 'Personnalisé']) {
      expect(chip(w, label), label).toBeTruthy()
    }
  })

  it('émet le changement de type et de vue', async () => {
    const w = mountFilters()

    await chip(w, 'Revenus').trigger('click')
    await chip(w, 'Année').trigger('click')

    expect(w.emitted('update:type')[0]).toEqual(['income'])
    expect(w.emitted('update:view')[0]).toEqual(['year'])
  })

  it('vue Mois : liste les mois en français avec majuscule', () => {
    const w = mountFilters()
    const select = w.find('select[aria-label="Mois"]')

    expect(select.exists()).toBe(true)
    expect(select.findAll('option').map((o) => o.text())).toEqual(['Septembre 2026', 'Août 2026'])
    expect(w.find('select[aria-label="Année"]').exists()).toBe(false)
  })

  it('vue Année : liste les années', () => {
    const w = mountFilters({ view: 'year' })

    expect(w.find('select[aria-label="Année"]').findAll('option').map((o) => o.text())).toEqual(['2026', '2025'])
    expect(w.find('select[aria-label="Mois"]').exists()).toBe(false)
  })

  it('émet le mois choisi', async () => {
    const w = mountFilters()

    await w.find('select[aria-label="Mois"]').setValue('2026-08')

    expect(w.emitted('update:month')[0]).toEqual(['2026-08'])
  })

  it('vue Personnalisé : deux dates bornées l\'une par l\'autre', async () => {
    const w = mountFilters({ view: 'custom' })
    const [from, to] = w.findAll('input[type="date"]')

    expect(from.element.value).toBe('2026-09-01')
    expect(from.attributes('max')).toBe('2026-09-21')
    expect(to.attributes('min')).toBe('2026-09-01')

    await to.setValue('2026-09-30')
    expect(w.emitted('update:to')[0]).toEqual(['2026-09-30'])
    expect(w.find('select').exists()).toBe(false)
  })
})
