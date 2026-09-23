/**
 * Tests composant — NotificationRow
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import NotificationRow from '@/components/molecules/NotificationRow.vue'

const notification = {
  id: 'n1', type: 'envelope_overspend', title: 'Enveloppe dépassée',
  message: 'L\'enveloppe « Vie quotidienne » a dépassé son plafond mensuel.',
  read: false, createdAt: '2026-09-20T10:00:00.000Z',
}

const mountRow = (props = {}) => mount(NotificationRow, { props: { notification, ...props } })
const button = (w, label) => w.find(`button[aria-label="${label}"]`)

describe('NotificationRow', () => {
  it('affiche le titre et le message', () => {
    const w = mountRow()

    expect(w.text()).toContain('Enveloppe dépassée')
    expect(w.text()).toContain('Vie quotidienne')
  })

  it('non lue : pastille visible', () => {
    expect(mountRow().find('.notification__dot').exists()).toBe(true)
    expect(mountRow({ notification: { ...notification, read: true } }).find('.notification__dot').exists()).toBe(false)
  })

  it('clic sur le corps émet open', async () => {
    const w = mountRow()

    await w.find('.notification__main').trigger('click')

    expect(w.emitted('open')).toHaveLength(1)
  })

  it('émet archive et remove', async () => {
    const w = mountRow()

    await button(w, 'Archiver').trigger('click')
    await button(w, 'Supprimer').trigger('click')

    expect(w.emitted('archive')).toHaveLength(1)
    expect(w.emitted('remove')).toHaveLength(1)
  })
})
