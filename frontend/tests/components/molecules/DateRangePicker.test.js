/**
 * Tests composant — DateRangePicker
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DateRangePicker from '@/components/molecules/DateRangePicker.vue'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(2026, 8, 15, 12)) // 15 septembre 2026 (mardi)
})
afterEach(() => vi.useRealTimers())

const mountPicker = (props = {}) => mount(DateRangePicker, { props })
const trigger = (w) => w.find('button[aria-haspopup="dialog"]')
const open = async (w) => { await trigger(w).trigger('click'); return w }
const day = (w, n) => w.findAll('button.day').find((b) => b.text() === String(n) && !b.classes().includes('day--outside'))

describe('DateRangePicker — bouton', () => {
  it('sans plage : « Toutes les dates », panneau fermé', () => {
    const w = mountPicker()

    expect(trigger(w).text()).toBe('Toutes les dates')
    expect(trigger(w).attributes('aria-expanded')).toBe('false')
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })

  it('résume la plage courante', () => {
    const w = mountPicker({ from: '2026-09-01', to: '2026-09-30' })

    expect(trigger(w).text()).toContain('→')
    expect(trigger(w).classes()).toContain('chip--active')
  })

  it('début seul : « Depuis le … »', () => {
    expect(mountPicker({ from: '2026-09-01' }).text()).toContain('Depuis le')
  })

  it('ouvre et referme le panneau', async () => {
    const w = await open(mountPicker())

    expect(w.find('[role="dialog"]').exists()).toBe(true)
    expect(trigger(w).attributes('aria-expanded')).toBe('true')

    await trigger(w).trigger('click')
    expect(w.find('[role="dialog"]').exists()).toBe(false)
  })
})

describe('DateRangePicker — calendrier', () => {
  it('affiche le mois courant, en semaines complètes commençant lundi', async () => {
    const w = await open(mountPicker())

    expect(w.text()).toContain('Septembre 2026')
    expect(w.findAll('button.day').length % 7).toBe(0)
    expect(w.findAll('.calendar__weekdays span').map((s) => s.text()).join('')).toBe('LMMJVSD')
    // 1er septembre 2026 = mardi → une case de la fin d'août avant
    expect(w.findAll('button.day')[0].classes()).toContain('day--outside')
  })

  it('marque aujourd\'hui', async () => {
    const w = await open(mountPicker())

    expect(day(w, 15).classes()).toContain('day--today')
  })

  it('navigue entre les mois', async () => {
    const w = await open(mountPicker())

    await w.find('button[aria-label="Mois suivant"]').trigger('click')
    expect(w.text()).toContain('Octobre 2026')

    await w.find('button[aria-label="Mois précédent"]').trigger('click')
    await w.find('button[aria-label="Mois précédent"]').trigger('click')
    expect(w.text()).toContain('Août 2026')
  })

  it('la flèche « précédent » est retournée, « suivant » pointe à droite', async () => {
    const w = await open(mountPicker())

    expect(w.find('button[aria-label="Mois précédent"] svg').classes()).toContain('calendar__nav-icon--prev')
    expect(w.find('button[aria-label="Mois suivant"] svg').classes()).not.toContain('calendar__nav-icon--prev')
  })

  it('s\'ouvre sur le mois du début de la plage', async () => {
    const w = await open(mountPicker({ from: '2026-03-10', to: '2026-03-20' }))

    expect(w.text()).toContain('Mars 2026')
  })
})

describe('DateRangePicker — sélection', () => {
  it('deux clics = début puis fin, un seul événement à la fin', async () => {
    const w = await open(mountPicker())

    await day(w, 10).trigger('click')
    expect(w.emitted('change')[0]).toEqual([{ from: '2026-09-10', to: '' }])

    await day(w, 20).trigger('click')
    expect(w.emitted('change')[1]).toEqual([{ from: '2026-09-10', to: '2026-09-20' }])
  })

  it('une fin antérieure au début inverse les bornes', async () => {
    const w = await open(mountPicker())

    await day(w, 20).trigger('click')
    await day(w, 10).trigger('click')

    expect(w.emitted('change')[1]).toEqual([{ from: '2026-09-10', to: '2026-09-20' }])
  })

  it('un clic après une plage complète recommence une sélection', async () => {
    const w = await open(mountPicker({ from: '2026-09-01', to: '2026-09-30' }))

    await day(w, 12).trigger('click')

    expect(w.emitted('change')[0]).toEqual([{ from: '2026-09-12', to: '' }])
  })

  it('colore début, fin et intervalle', async () => {
    const w = await open(mountPicker({ from: '2026-09-10', to: '2026-09-13' }))

    expect(day(w, 10).classes()).toContain('day--start')
    expect(day(w, 13).classes()).toContain('day--end')
    expect(day(w, 11).classes()).toContain('day--in-range')
    expect(day(w, 12).classes()).toContain('day--in-range')
    expect(day(w, 14).classes()).not.toContain('day--in-range')
  })

  it('prévisualise la fin au survol tant qu\'elle n\'est pas cliquée', async () => {
    const w = await open(mountPicker())

    await day(w, 10).trigger('click')
    await day(w, 14).trigger('mouseenter')

    expect(day(w, 12).classes()).toContain('day--in-range')
    expect(day(w, 14).classes()).toContain('day--end')
  })

  it('« Réinitialiser » vide la plage', async () => {
    const w = await open(mountPicker({ from: '2026-09-10', to: '2026-09-13' }))

    await w.findAll('button').find((b) => b.text().includes('Réinitialiser')).trigger('click')

    expect(w.emitted('change').at(-1)).toEqual([{ from: '', to: '' }])
    expect(trigger(w).text()).toBe('Toutes les dates')
  })

  it('pas de « Réinitialiser » sans plage', async () => {
    const w = await open(mountPicker())

    expect(w.text()).not.toContain('Réinitialiser')
  })

  it('suit les changements de props', async () => {
    const w = mountPicker()

    await w.setProps({ from: '2026-09-01', to: '2026-09-30' })

    expect(trigger(w).text()).toContain('→')
  })
})
