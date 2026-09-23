/**
 * Tests composant — TrendBadge
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TrendBadge from '@/components/molecules/TrendBadge.vue'

const mountBadge = (props) => mount(TrendBadge, { props: { label: 'août 2026', ...props } })
const visual = (w) => w.find('.trend__visual').text()

describe('TrendBadge', () => {
  it('hausse : flèche, pourcentage signé et période comparée', () => {
    const w = mountBadge({ percent: 12.3, direction: 'up', tone: 'bad' })

    expect(visual(w)).toContain('▲')
    expect(visual(w)).toContain('+12,3 %')
    expect(visual(w)).toContain('vs août 2026')
  })

  it('baisse : flèche vers le bas et signe moins', () => {
    const w = mountBadge({ percent: -25, direction: 'down', tone: 'good' })

    expect(visual(w)).toContain('▼')
    expect(visual(w)).toMatch(/[-−]25 %/)
  })

  it('à plat : ni signe ni couleur', () => {
    const w = mountBadge({ percent: 0, direction: 'flat', tone: 'neutral' })

    expect(visual(w)).toContain('0 %')
    expect(visual(w)).not.toMatch(/[+−-]0/)
  })

  it('la couleur suit le caractère favorable, pas le sens', () => {
    expect(mountBadge({ percent: 10, direction: 'up', tone: 'bad' }).classes()).toContain('trend--bad')
    expect(mountBadge({ percent: -10, direction: 'down', tone: 'good' }).classes()).toContain('trend--good')
    expect(mountBadge({ percent: 0, direction: 'flat', tone: 'neutral' }).classes()).toContain('trend--neutral')
  })

  it('sans base de comparaison : le dit, sans pourcentage', () => {
    const w = mountBadge({ percent: null, direction: 'up', tone: 'neutral' })

    expect(visual(w)).toBe('Pas de données en août 2026')
    expect(visual(w)).not.toContain('%')
  })

  it('le visuel est masqué aux lecteurs d\'écran, remplacé par une phrase complète', () => {
    const w = mountBadge({ percent: 12.3, direction: 'up', tone: 'bad' })

    expect(w.find('.trend__visual').attributes('aria-hidden')).toBe('true')
    expect(w.find('.trend__sr').text()).toBe('En hausse de 12,3 % par rapport à août 2026.')
  })

  it.each([
    [{ percent: -8, direction: 'down' }, 'En baisse de 8 % par rapport à août 2026.'],
    [{ percent: 0, direction: 'flat' }, 'Identique à août 2026.'],
    [{ percent: null, direction: 'up' }, 'Aucune donnée sur août 2026 pour comparer.'],
  ])('phrase lue : %j', (props, sentence) => {
    expect(mountBadge({ tone: 'neutral', ...props }).find('.trend__sr').text()).toBe(sentence)
  })
})
