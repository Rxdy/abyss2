/**
 * Tests store — app (thème clair/sombre)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAppStore, resolveInitialTheme, applyTheme } from '@/stores/app.store.js'

/** Simule la préférence système. */
function mockPrefersLight(prefersLight) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query === '(prefers-color-scheme: light)' ? prefersLight : !prefersLight,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

beforeEach(() => {
  setActivePinia(createPinia())
  mockPrefersLight(false)
})

describe('resolveInitialTheme', () => {
  it('sombre par défaut quand rien n\'est stocké et que l\'OS est sombre', () => {
    expect(resolveInitialTheme()).toBe('dark')
  })

  it('suit la préférence système claire quand rien n\'est stocké', () => {
    mockPrefersLight(true)
    expect(resolveInitialTheme()).toBe('light')
  })

  it('le choix stocké l\'emporte sur la préférence système', () => {
    localStorage.setItem('abyss2_theme', 'dark')
    mockPrefersLight(true)
    expect(resolveInitialTheme()).toBe('dark')
  })

  it('ignore une valeur stockée invalide', () => {
    localStorage.setItem('abyss2_theme', 'fuchsia')
    expect(resolveInitialTheme()).toBe('dark')
  })
})

describe('applyTheme', () => {
  it('pose data-theme sur <html>', () => {
    applyTheme('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })
})

describe('app store', () => {
  it('setTheme met à jour le state, le storage et le DOM', () => {
    const app = useAppStore()
    app.setTheme('light')

    expect(app.theme).toBe('light')
    expect(app.isLight).toBe(true)
    expect(app.isDark).toBe(false)
    expect(localStorage.getItem('abyss2_theme')).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('toggleTheme fait l\'aller-retour sombre ↔ clair', () => {
    const app = useAppStore()
    app.setTheme('dark')

    app.toggleTheme()
    expect(app.theme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')

    app.toggleTheme()
    expect(app.theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })

  it('retombe sur sombre pour une valeur inconnue', () => {
    const app = useAppStore()
    app.setTheme('fuchsia')
    expect(app.theme).toBe('dark')
  })

  it('initTheme applique la préférence système en l\'absence de choix', () => {
    mockPrefersLight(true)
    const app = useAppStore()
    app.initTheme()

    expect(app.theme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('initTheme restaure le choix précédent', () => {
    localStorage.setItem('abyss2_theme', 'light')
    const app = useAppStore()
    app.initTheme()

    expect(app.theme).toBe('light')
  })
})
