/**
 * Tests — fitIosStandaloneViewport (hauteur de l'app installée sur iPhone)
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { fitIosStandaloneViewport } from '@/composables/iosStandaloneViewport.js'

const root = document.documentElement

/** Fenêtre factice : un iPhone 390×844, application installée ou non. */
function fakeWindow({ standalone = true, innerWidth = 390, innerHeight = 797, screen = { width: 390, height: 844 } } = {}) {
  const listeners = {}
  return {
    navigator: { standalone },
    document,
    screen,
    innerWidth,
    innerHeight,
    addEventListener: (type, fn) => { listeners[type] = fn },
    fire: (type) => listeners[type]?.(),
  }
}

beforeEach(() => {
  root.classList.remove('ios-standalone')
  root.style.removeProperty('--app-height')
})

describe('fitIosStandaloneViewport', () => {
  it('donne au body la hauteur de l\'écran dans l\'app installée sur iPhone', () => {
    fitIosStandaloneViewport(fakeWindow())

    expect(root.classList.contains('ios-standalone')).toBe(true)
    expect(root.style.getPropertyValue('--app-height')).toBe('844px')
  })

  it('ne touche à rien hors de l\'app installée sur iOS', () => {
    fitIosStandaloneViewport(fakeWindow({ standalone: false }))

    expect(root.classList.contains('ios-standalone')).toBe(false)
    expect(root.style.getPropertyValue('--app-height')).toBe('')
  })

  it('remet les côtés de l\'écran dans l\'ordre en paysage', () => {
    fitIosStandaloneViewport(fakeWindow({ innerWidth: 844, innerHeight: 390 }))

    expect(root.style.getPropertyValue('--app-height')).toBe('390px')
  })

  it('s\'abstient quand la fenêtre n\'occupe pas tout l\'écran (iPad en écran partagé)', () => {
    fitIosStandaloneViewport(fakeWindow({ innerWidth: 507, innerHeight: 1366, screen: { width: 1024, height: 1366 } }))

    expect(root.classList.contains('ios-standalone')).toBe(false)
  })

  it('suit la rotation de l\'appareil', () => {
    const win = fakeWindow()
    fitIosStandaloneViewport(win)

    win.innerWidth = 844
    win.innerHeight = 390
    win.fire('resize')

    expect(root.style.getPropertyValue('--app-height')).toBe('390px')
  })
})
