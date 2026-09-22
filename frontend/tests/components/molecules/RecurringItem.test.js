/**
 * Tests composant — RecurringItem
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RecurringItem from '@/components/molecules/RecurringItem.vue'

const ITEM = {
  id: 'r1', title: 'Loyer', amount: 72000, type: 'expense', dayOfMonth: 5, active: true,
  nextDate: '2026-10-05', category: { id: 'c1', name: 'Logement', color: '#a78bfa' },
}
const mountItem = (over = {}) => mount(RecurringItem, { props: { item: { ...ITEM, ...over } } })

describe('RecurringItem', () => {
  it('affiche libellé, échéance, catégorie et montant signé', () => {
    const w = mountItem()

    expect(w.text()).toContain('Loyer')
    expect(w.text()).toContain('Le 5 de chaque mois')
    expect(w.text()).toContain('Logement')
    expect(w.text()).toContain('prochaine le')
    expect(w.text()).toContain('720,00')
    expect(w.text()).toMatch(/-\s?720,00|−\s?720,00/)
  })

  it('un revenu n\'a pas de signe moins', () => {
    const w = mountItem({ type: 'income', title: 'Salaire', amount: 235000 })

    expect(w.text()).toContain('2')
    expect(w.text()).not.toMatch(/[-−]\s?2\s?350/)
  })

  it('en pause : estompée, libellé « en pause » et action « Reprendre »', () => {
    const w = mountItem({ active: false })

    expect(w.classes()).toContain('item--paused')
    expect(w.text()).toContain('en pause')
    expect(w.find('button[aria-label="Reprendre Loyer"]').exists()).toBe(true)
  })

  it('active : action « Mettre en pause »', () => {
    expect(mountItem().find('button[aria-label="Mettre en pause Loyer"]').exists()).toBe(true)
  })

  it('sans prochaine échéance : « terminée »', () => {
    expect(mountItem({ nextDate: null }).text()).toContain('terminée')
  })

  it('sans catégorie : pas de séparateur de catégorie', () => {
    expect(mountItem({ category: null }).text()).not.toContain('Logement')
  })

  it('émet toggle, edit et remove', async () => {
    const w = mountItem()

    await w.find('button[aria-label="Mettre en pause Loyer"]').trigger('click')
    await w.find('button[aria-label="Modifier Loyer"]').trigger('click')
    await w.find('button[aria-label="Supprimer Loyer"]').trigger('click')

    expect(w.emitted('toggle')).toHaveLength(1)
    expect(w.emitted('edit')).toHaveLength(1)
    expect(w.emitted('remove')).toHaveLength(1)
  })
})
