/**
 * Tests composant — CategoryRow
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CategoryRow from '@/components/molecules/CategoryRow.vue'

const category = { id: 'c1', name: 'Alimentation', color: '#4ade80' }
const mountRow = (props = {}) => mount(CategoryRow, { props: { category, ...props } })
const button = (w, label) => w.find(`button[aria-label="${label}"]`)

describe('CategoryRow', () => {
  it('affiche le nom et propose les quatre actions', () => {
    const w = mountRow()

    expect(w.text()).toContain('Alimentation')
    for (const label of ['Monter', 'Descendre', 'Modifier', 'Supprimer']) {
      expect(button(w, `${label} Alimentation`).exists(), label).toBe(true)
    }
  })

  it('émet move (up / down), edit et remove', async () => {
    const w = mountRow()

    await button(w, 'Monter Alimentation').trigger('click')
    await button(w, 'Descendre Alimentation').trigger('click')
    await button(w, 'Modifier Alimentation').trigger('click')
    await button(w, 'Supprimer Alimentation').trigger('click')

    expect(w.emitted('move')).toEqual([['up'], ['down']])
    expect(w.emitted('edit')).toHaveLength(1)
    expect(w.emitted('remove')).toHaveLength(1)
  })

  it('désactive « Monter » en tête de liste et « Descendre » en queue', () => {
    expect(button(mountRow({ first: true }), 'Monter Alimentation').attributes('disabled')).toBeDefined()
    expect(button(mountRow({ last: true }), 'Descendre Alimentation').attributes('disabled')).toBeDefined()
    expect(button(mountRow(), 'Monter Alimentation').attributes('disabled')).toBeUndefined()
  })

  it('désactive les deux flèches pendant un réordonnancement', () => {
    const w = mountRow({ busy: true })

    expect(button(w, 'Monter Alimentation').attributes('disabled')).toBeDefined()
    expect(button(w, 'Descendre Alimentation').attributes('disabled')).toBeDefined()
  })

  it('une sous-catégorie est en retrait', () => {
    expect(mountRow({ child: true }).classes()).toContain('category--child')
    expect(mountRow().classes()).not.toContain('category--child')
  })
})

describe('CategoryRow — budget', () => {
  it('affiche le budget mensuel sous le nom', () => {
    const w = mountRow({ category: { ...category, budget: 40000 } })

    expect(w.text()).toMatch(/Budget 400,00\s€ \/ mois/)
  })

  it('rien sans budget', () => {
    expect(mountRow().text()).not.toContain('Budget')
    expect(mountRow({ category: { ...category, budget: null } }).text()).not.toContain('Budget')
  })
})

