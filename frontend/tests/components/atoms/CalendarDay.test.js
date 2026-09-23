/**
 * Tests composant — CalendarDay
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CalendarDay from '@/components/atoms/CalendarDay.vue'

describe('CalendarDay', () => {
  it('est un bouton qui affiche le numéro du jour', () => {
    const w = mount(CalendarDay, { props: { day: 17 } })

    expect(w.element.tagName).toBe('BUTTON')
    expect(w.attributes('type')).toBe('button')
    expect(w.text()).toBe('17')
  })

  it('applique les états demandés, et rien de plus par défaut', () => {
    expect(mount(CalendarDay, { props: { day: 1 } }).classes()).toEqual(['day'])

    const w = mount(CalendarDay, { props: { day: 1, outside: true, today: true, inRange: true } })
    expect(w.classes()).toEqual(expect.arrayContaining(['day--outside', 'day--today', 'day--in-range']))
  })

  it('les bornes de la plage sont annoncées comme sélectionnées', () => {
    expect(mount(CalendarDay, { props: { day: 1, start: true } }).attributes('aria-pressed')).toBe('true')
    expect(mount(CalendarDay, { props: { day: 1, end: true } }).attributes('aria-pressed')).toBe('true')
    expect(mount(CalendarDay, { props: { day: 1, inRange: true } }).attributes('aria-pressed')).toBe('false')
  })

  it('laisse passer clic et survol au parent', async () => {
    const calls = []
    const w = mount(CalendarDay, {
      props: { day: 5 },
      attrs: { onClick: () => calls.push('click'), onMouseenter: () => calls.push('enter') },
    })

    await w.trigger('mouseenter')
    await w.trigger('click')

    expect(calls).toEqual(['enter', 'click'])
  })
})
