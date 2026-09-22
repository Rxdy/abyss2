/**
 * Tests composant — EnvelopeRow
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EnvelopeRow from '@/components/molecules/EnvelopeRow.vue'

const envelope = { id: 'e1', name: 'Vie quotidienne', budget: 40000, categoryIds: ['food', 'fun'] }
const mountRow = (props = {}) => mount(EnvelopeRow, { props: { envelope, ...props } })
const button = (w, label) => w.find(`button[aria-label="${label}"]`)

describe('EnvelopeRow', () => {
  it('affiche le nom, le montant alloué et les deux actions', () => {
    const w = mountRow()

    expect(w.text()).toContain('Vie quotidienne')
    expect(w.text()).toMatch(/400,00\s€ \/ mois/)
    expect(button(w, 'Modifier Vie quotidienne').exists()).toBe(true)
    expect(button(w, 'Supprimer Vie quotidienne').exists()).toBe(true)
  })

  it('émet edit et remove', async () => {
    const w = mountRow()

    await button(w, 'Modifier Vie quotidienne').trigger('click')
    await button(w, 'Supprimer Vie quotidienne').trigger('click')

    expect(w.emitted('edit')).toHaveLength(1)
    expect(w.emitted('remove')).toHaveLength(1)
  })

  it('liste les noms des catégories liées', () => {
    const w = mountRow({ categoryNames: ['Alimentation', 'Loisirs'] })

    expect(w.text()).toContain('Alimentation')
    expect(w.text()).toContain('Loisirs')
  })

  it('sans catégorie liée : message dédié', () => {
    const w = mountRow({ categoryNames: [] })

    expect(w.text()).toContain('Aucune catégorie liée.')
  })
})
