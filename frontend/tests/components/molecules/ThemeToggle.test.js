/**
 * Tests composant — ThemeToggle
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ThemeToggle from '@/components/molecules/ThemeToggle.vue'
import { useAppStore } from '@/stores/app.store.js'

// La pinia active est créée par tests/setup.js — c'est la même que celle
// injectée aux composants montés, ne pas en recréer une ici.
beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
})

describe('ThemeToggle', () => {
  it('bascule le thème au clic', async () => {
    const app = useAppStore()
    app.setTheme('dark')
    const w = mount(ThemeToggle)

    await w.trigger('click')
    expect(app.theme).toBe('light')

    await w.trigger('click')
    expect(app.theme).toBe('dark')
  })

  it('décrit l\'action à venir pour les lecteurs d\'écran', async () => {
    const app = useAppStore()
    app.setTheme('dark')
    const w = mount(ThemeToggle)

    expect(w.attributes('aria-label')).toBe('Passer en thème clair')
    expect(w.attributes('aria-pressed')).toBe('false')

    await w.trigger('click')

    expect(w.attributes('aria-label')).toBe('Passer en thème sombre')
    expect(w.attributes('aria-pressed')).toBe('true')
  })

  it('change d\'icône selon le thème', async () => {
    const app = useAppStore()
    app.setTheme('dark')
    const w = mount(ThemeToggle)

    const darkIcon = w.find('svg').html()
    await w.trigger('click')
    expect(w.find('svg').html()).not.toBe(darkIcon)
  })
})
