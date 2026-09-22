/**
 * Tests composant — TransactionItem
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TransactionItem from '@/components/molecules/TransactionItem.vue'

const TX = {
  id: 't1', title: 'Courses', amount: 4250, date: '2026-09-05', type: 'expense', note: null, recurringId: null,
  category: { id: 'c1', name: 'Alimentation', color: '#4ade80' },
}
const mountItem = (over = {}, props = {}) => mount(TransactionItem, { props: { transaction: { ...TX, ...over }, ...props } })

describe('TransactionItem — contenu', () => {
  it('affiche libellé, date courte, catégorie et montant', () => {
    const w = mountItem()

    expect(w.text()).toContain('Courses')
    expect(w.text()).toMatch(/5\s+sept/)
    expect(w.text()).toContain('Alimentation')
    expect(w.text()).toMatch(/42,50/)
  })

  it('une dépense est en négatif et en rouge', () => {
    const w = mountItem()

    expect(w.find('.transaction__amount').text()).toMatch(/^[-−]\s?42,50/)
    expect(w.find('.transaction__amount').classes().join(' ')).toMatch(/danger/)
  })

  it('un revenu n\'a pas de signe moins, et est en vert', () => {
    const w = mountItem({ type: 'income', amount: 235000 })

    expect(w.find('.transaction__amount').text()).not.toMatch(/[-−]/)
    expect(w.find('.transaction__amount').classes().join(' ')).toMatch(/success/)
  })

  it('sans catégorie : pas de séparateur ni de nom', () => {
    const w = mountItem({ category: null })

    expect(w.text()).not.toContain('·')
  })

  it('la pastille prend la couleur de la catégorie, ou la teinte neutre', () => {
    expect(mountItem().find('.transaction__color').attributes('style')).toContain('#4ade80')
    expect(mountItem({ category: null }).find('.transaction__color').attributes('style')).toContain('var(--color-text-muted)')
  })

  it('une transaction générée par une charge fixe est signalée (horloge + « Fixe »)', () => {
    const w = mountItem({ recurringId: 'r1' })

    expect(w.text()).toContain('Fixe')
    expect(w.find('.transaction__recurring-badge').exists()).toBe(true)
  })

  it('une transaction saisie à la main ne l\'est pas', () => {
    const w = mountItem()

    expect(w.text()).not.toContain('Fixe')
    expect(w.find('.transaction__recurring-badge').exists()).toBe(false)
  })
})

describe('TransactionItem — interaction', () => {
  it('par défaut : un simple bloc, sans rôle de bouton', () => {
    const w = mountItem()

    expect(w.element.tagName).toBe('DIV')
    expect(w.classes()).not.toContain('transaction--clickable')
  })

  it('cliquable : un vrai bouton', () => {
    const w = mountItem({}, { clickable: true })

    expect(w.element.tagName).toBe('BUTTON')
    expect(w.attributes('type')).toBe('button')
    expect(w.classes()).toContain('transaction--clickable')
  })

  it('cliquable : émet select avec la transaction', async () => {
    const transaction = { ...TX }
    const w = mount(TransactionItem, { props: { transaction, clickable: true } })

    await w.trigger('click')

    expect(w.emitted('select')).toEqual([[transaction]])
  })

  it('non cliquable : le clic n\'émet rien', async () => {
    const w = mountItem()

    await w.trigger('click')

    expect(w.emitted('select')).toBeUndefined()
  })
})
