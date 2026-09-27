/**
 * Tests composable — usePwaInstall
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { listenForInstall, resetPwaInstall, usePwaInstall } from '@/composables/usePwaInstall.js'

/** Événement `beforeinstallprompt` factice. */
function installEvent(outcome = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true })
  event.prompt = vi.fn().mockResolvedValue(undefined)
  event.userChoice = Promise.resolve({ outcome })
  return event
}

beforeEach(() => {
  resetPwaInstall()
  listenForInstall()
})

describe('usePwaInstall — disponibilité', () => {
  it('n\'est pas disponible tant que le navigateur ne propose rien', () => {
    expect(usePwaInstall().available.value).toBe(false)
  })

  it('devient disponible à la réception de beforeinstallprompt', () => {
    const pwa = usePwaInstall()
    window.dispatchEvent(installEvent())

    expect(pwa.canPrompt.value).toBe(true)
    expect(pwa.available.value).toBe(true)
  })

  it('bloque la mini-barre native (preventDefault) pour garder la main sur l\'invite', () => {
    const event = installEvent()
    window.dispatchEvent(event)

    expect(event.defaultPrevented).toBe(true)
  })

  it('disparaît une fois l\'application installée', () => {
    const pwa = usePwaInstall()
    window.dispatchEvent(installEvent())
    window.dispatchEvent(new Event('appinstalled'))

    expect(pwa.installed.value).toBe(true)
    expect(pwa.available.value).toBe(false)
  })

  it('n\'enregistre les écouteurs qu\'une seule fois', () => {
    const add = vi.spyOn(window, 'addEventListener')
    listenForInstall()
    listenForInstall()

    expect(add).not.toHaveBeenCalled()
  })
})

describe('usePwaInstall — install()', () => {
  it('ouvre l\'invite native et renvoie le choix de l\'utilisateur', async () => {
    const event = installEvent('accepted')
    const pwa = usePwaInstall()
    window.dispatchEvent(event)

    expect(await pwa.install()).toBe('accepted')
    expect(event.prompt).toHaveBeenCalledOnce()
  })

  it('n\'est plus disponible après l\'invite (prompt() est à usage unique)', async () => {
    const pwa = usePwaInstall()
    window.dispatchEvent(installEvent('dismissed'))

    expect(await pwa.install()).toBe('dismissed')
    expect(pwa.available.value).toBe(false)
  })

  it('renvoie "unavailable" sans invite disponible', async () => {
    expect(await usePwaInstall().install()).toBe('unavailable')
  })
})

describe('usePwaInstall — iOS', () => {
  it('propose les instructions manuelles sur iPhone (pas de beforeinstallprompt)', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
    )
    const pwa = usePwaInstall()

    expect(pwa.needsManual.value).toBe(true)
    expect(pwa.canPrompt.value).toBe(false)
    expect(pwa.available.value).toBe(true)
  })

  it('reconnaît un iPad qui se fait passer pour un Mac', () => {
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel')
    vi.spyOn(navigator, 'maxTouchPoints', 'get').mockReturnValue(5)

    expect(usePwaInstall().needsManual.value).toBe(true)
  })
})
