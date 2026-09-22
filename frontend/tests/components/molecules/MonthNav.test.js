/**
 * Tests composant — MonthNav
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MonthNav from '@/components/molecules/MonthNav.vue'

const mountNav = (props = {}) => mount(MonthNav, { props: { modelValue: '2026-09', min: '2026-03', max: '2026-09', ...props } })
const prev = (w) => w.find('button[aria-label="Mois précédent"]')
const next = (w) => w.find('button[aria-label="Mois suivant"]')

describe('MonthNav', () => {
  it('affiche le mois en toutes lettres, avec majuscule', () => {
    expect(mountNav().text()).toContain('Septembre 2026')
  })

  it('« précédent » émet le mois d\'avant', async () => {
    const w = mountNav({ modelValue: '2026-05' })

    await prev(w).trigger('click')

    expect(w.emitted('update:modelValue')[0]).toEqual(['2026-04'])
  })

  it('« suivant » émet le mois d\'après', async () => {
    const w = mountNav({ modelValue: '2026-05' })

    await next(w).trigger('click')

    expect(w.emitted('update:modelValue')[0]).toEqual(['2026-06'])
  })

  it('passe le 1er janvier sur décembre de l\'année d\'avant', async () => {
    const w = mountNav({ modelValue: '2026-01', min: '2025-01' })

    await prev(w).trigger('click')

    expect(w.emitted('update:modelValue')[0]).toEqual(['2025-12'])
  })

  it('bloque « précédent » sur le plus ancien mois', () => {
    expect(prev(mountNav({ modelValue: '2026-03' })).attributes('disabled')).toBeDefined()
    expect(prev(mountNav({ modelValue: '2026-04' })).attributes('disabled')).toBeUndefined()
  })

  it('bloque « suivant » sur le mois courant : pas de futur', () => {
    expect(next(mountNav({ modelValue: '2026-09' })).attributes('disabled')).toBeDefined()
    expect(next(mountNav({ modelValue: '2026-08' })).attributes('disabled')).toBeUndefined()
  })

  it('sans bornes : rien n\'est bloqué', () => {
    const w = mountNav({ min: '', max: '' })

    expect(prev(w).attributes('disabled')).toBeUndefined()
    expect(next(w).attributes('disabled')).toBeUndefined()
  })

  it('un clic sur un bouton bloqué n\'émet rien', async () => {
    const w = mountNav({ modelValue: '2026-09' })

    await next(w).trigger('click')

    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('propose un retour au mois en cours quand on s\'en est éloigné', async () => {
    const w = mountNav({ modelValue: '2026-05' })

    await w.findAll('button').find((b) => b.text() === 'Mois en cours').trigger('click')

    expect(w.emitted('update:modelValue')[0]).toEqual(['2026-09'])
  })

  it('pas de raccourci sur le mois en cours', () => {
    expect(mountNav().text()).not.toContain('Mois en cours')
  })

  it('le groupe est nommé pour les lecteurs d\'écran', () => {
    expect(mountNav().find('[role="group"]').attributes('aria-label')).toBe('Choisir le mois')
  })
})
