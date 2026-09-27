/**
 * Tests composant — ThemeSettings (réglage du thème, page Profil)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ThemeSettings from '@/components/organisms/ThemeSettings.vue'
import { useAppStore } from '@/stores/app.store.js'

/** Simule la préférence de l'appareil ; renvoie de quoi déclencher un changement. */
function mockDevice(prefersLight) {
  const listeners = []
  const query = {
    get matches() { return prefersLight },
    addEventListener: vi.fn((_, fn) => listeners.push(fn)),
  }
  window.matchMedia = vi.fn(() => query)
  return {
    change(next) {
      prefersLight = next
      listeners.forEach((fn) => fn())
    },
  }
}

const option = (w, label) => w.findAll('button').find((b) => b.text() === label)
const pressed = (w) => w.findAll('button[aria-pressed="true"]').map((b) => b.text())

beforeEach(() => mockDevice(false))

describe('ThemeSettings', () => {
  it('propose sombre, clair et système, et marque le choix courant', () => {
    useAppStore().setPreference('light')
    const w = mount(ThemeSettings)

    expect(w.findAll('button').map((b) => b.text())).toEqual(['Sombre', 'Clair', 'Système'])
    expect(pressed(w)).toEqual(['Clair'])
  })

  it('choisir « Clair » applique et mémorise le thème', async () => {
    const w = mount(ThemeSettings)

    await option(w, 'Clair').trigger('click')

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem('abyss2_theme')).toBe('light')
    expect(pressed(w)).toEqual(['Clair'])
  })

  it('« Système » suit l\'appareil et l\'indique', async () => {
    mockDevice(true)
    const w = mount(ThemeSettings)

    await option(w, 'Système').trigger('click')

    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    expect(localStorage.getItem('abyss2_theme')).toBe('system')
    expect(w.text()).toContain('actuellement clair')
  })
})

describe('app.store — mode système', () => {
  it('suit en direct un changement de l\'appareil', () => {
    const device = mockDevice(false)
    localStorage.setItem('abyss2_theme', 'system')
    const app = useAppStore()
    app.initTheme()
    expect(app.theme).toBe('dark')

    device.change(true)

    expect(app.theme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('un thème fixe ignore les changements de l\'appareil', () => {
    const device = mockDevice(false)
    localStorage.setItem('abyss2_theme', 'dark')
    const app = useAppStore()
    app.initTheme()

    device.change(true)

    expect(app.theme).toBe('dark')
  })

  it('une préférence stockée invalide retombe sur « système »', () => {
    mockDevice(true)
    localStorage.setItem('abyss2_theme', 'violet')
    const app = useAppStore()
    app.initTheme()

    expect(app.preference).toBe('system')
    expect(app.theme).toBe('light')
  })
})
