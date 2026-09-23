/**
 * Tests composant — TransactionList
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TransactionList from '@/components/organisms/TransactionList.vue'

const tx = (n, over = {}) => ({
  id: `t${n}`, title: `Opération ${n}`, amount: 1000 * n, date: '2026-09-01', type: 'expense', note: null, recurringId: null, category: null, ...over,
})
const mountList = (props = {}) => mount(TransactionList, { props })

describe('TransactionList — états', () => {
  it('affiche « Chargement… » pendant le chargement, sans liste', () => {
    const w = mountList({ loading: true, transactions: [tx(1)] })

    expect(w.text()).toContain('Chargement…')
    expect(w.find('ul').exists()).toBe(false)
  })

  it('liste vide : le message par défaut', () => {
    expect(mountList().text()).toContain('Aucune transaction pour l\'instant.')
  })

  it('liste vide : le message fourni par la page', () => {
    expect(mountList({ emptyLabel: 'Aucune transaction ne correspond à ces filtres.' }).text())
      .toContain('Aucune transaction ne correspond à ces filtres.')
  })

  it('le chargement l\'emporte sur le message « vide »', () => {
    const w = mountList({ loading: true })

    expect(w.text()).toContain('Chargement…')
    expect(w.text()).not.toContain('Aucune transaction')
  })
})

describe('TransactionList — lignes', () => {
  it('une ligne par transaction, dans l\'ordre reçu', () => {
    const w = mountList({ transactions: [tx(3), tx(1), tx(2)] })

    expect(w.findAll('li')).toHaveLength(3)
    expect(w.findAll('li').map((li) => li.text().match(/Opération \d/)[0])).toEqual(['Opération 3', 'Opération 1', 'Opération 2'])
  })

  it('lignes non cliquables par défaut', () => {
    const w = mountList({ transactions: [tx(1)] })

    expect(w.find('li button').exists()).toBe(false)
  })

  it('cliquables : chaque ligne est un bouton', () => {
    const w = mountList({ transactions: [tx(1), tx(2)], clickable: true })

    expect(w.findAll('li button')).toHaveLength(2)
  })

  it('relaie select avec la transaction touchée', async () => {
    const touched = tx(2)
    const w = mountList({ transactions: [tx(1), touched], clickable: true })

    await w.findAll('li button')[1].trigger('click')

    expect(w.emitted('select')).toEqual([[touched]])
  })
})
