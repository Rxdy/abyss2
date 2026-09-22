/**
 * Tests composant — AlertBanner
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AlertBanner from '@/components/molecules/AlertBanner.vue'

describe('AlertBanner', () => {
  it('annonce son message aux lecteurs d\'écran', () => {
    const w = mount(AlertBanner, { slots: { default: 'Échec de la connexion.' } })

    expect(w.attributes('role')).toBe('alert')
    expect(w.text()).toBe('Échec de la connexion.')
  })

  it('est rouge par défaut et accepte success / warning', () => {
    expect(mount(AlertBanner).classes()).toContain('alert--danger')
    expect(mount(AlertBanner, { props: { variant: 'success' } }).classes()).toContain('alert--success')
    expect(mount(AlertBanner, { props: { variant: 'warning' } }).classes()).toContain('alert--warning')
  })
})
