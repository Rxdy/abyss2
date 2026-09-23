/**
 * Tests composable — usePwaUpdate
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CHECK_EVERY_MS, registerPwaUpdates, resetPwaUpdate, usePwaUpdate } from '@/composables/usePwaUpdate.js'

/** `registerSW` factice : garde les rappels du composable et renvoie `updateSW`. */
function fakeRegisterSW() {
  const updateSW = vi.fn()
  const register = vi.fn((callbacks) => { register.callbacks = callbacks; return updateSW })
  return { register, updateSW }
}

beforeEach(() => {
  resetPwaUpdate()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('usePwaUpdate — annonce', () => {
  it('rien à annoncer tant que le service worker ne dit rien', () => {
    const { register } = fakeRegisterSW()
    registerPwaUpdates(register)

    expect(usePwaUpdate().visible.value).toBe(false)
  })

  it('une nouvelle version prête devient visible', () => {
    const { register } = fakeRegisterSW()
    registerPwaUpdates(register)

    register.callbacks.onNeedRefresh()

    expect(usePwaUpdate().updateReady.value).toBe(true)
    expect(usePwaUpdate().visible.value).toBe(true)
  })

  it('« Plus tard » masque l\'invitation', () => {
    const { register } = fakeRegisterSW()
    registerPwaUpdates(register)
    register.callbacks.onNeedRefresh()

    usePwaUpdate().dismiss()

    expect(usePwaUpdate().visible.value).toBe(false)
    expect(usePwaUpdate().updateReady.value).toBe(true) // la version reste prête
  })

  it('une version encore plus récente après un « plus tard » réaffiche l\'invitation', () => {
    const { register } = fakeRegisterSW()
    registerPwaUpdates(register)
    register.callbacks.onNeedRefresh()
    usePwaUpdate().dismiss()

    register.callbacks.onNeedRefresh()

    expect(usePwaUpdate().visible.value).toBe(true)
  })
})

describe('usePwaUpdate — activation', () => {
  it('« Mettre à jour » active la nouvelle version ET recharge (updateSW(true))', () => {
    const { register, updateSW } = fakeRegisterSW()
    registerPwaUpdates(register)

    usePwaUpdate().update()

    expect(updateSW).toHaveBeenCalledWith(true)
  })

  it('sans service worker enregistré, ne plante pas', () => {
    expect(() => usePwaUpdate().update()).not.toThrow()
  })
})

describe('usePwaUpdate — recherche de nouvelle version', () => {
  const setup = () => {
    const { register } = fakeRegisterSW()
    registerPwaUpdates(register)
    const registration = { update: vi.fn().mockResolvedValue(undefined) }
    register.callbacks.onRegisteredSW('/sw.js', registration)
    return registration
  }

  it('cherche toutes les heures', () => {
    const registration = setup()

    vi.advanceTimersByTime(CHECK_EVERY_MS - 1)
    expect(registration.update).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(registration.update).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(CHECK_EVERY_MS)
    expect(registration.update).toHaveBeenCalledTimes(2)
  })

  it('cherche aussi quand l\'app revient au premier plan', () => {
    const registration = setup()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })

    document.dispatchEvent(new Event('visibilitychange'))

    expect(registration.update).toHaveBeenCalledTimes(1)
  })

  it('ne cherche pas quand l\'app passe en arrière-plan', () => {
    const registration = setup()
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })

    document.dispatchEvent(new Event('visibilitychange'))

    expect(registration.update).not.toHaveBeenCalled()
  })

  it('un échec de recherche (hors ligne) n\'est pas une erreur', async () => {
    const { register } = fakeRegisterSW()
    registerPwaUpdates(register)
    const registration = { update: vi.fn().mockRejectedValue(new Error('offline')) }
    register.callbacks.onRegisteredSW('/sw.js', registration)

    vi.advanceTimersByTime(CHECK_EVERY_MS)
    await vi.advanceTimersByTimeAsync(0)

    expect(registration.update).toHaveBeenCalled()
  })

  it('sans enregistrement (navigateur sans service worker) : rien à planifier', () => {
    const { register } = fakeRegisterSW()
    registerPwaUpdates(register)

    expect(() => register.callbacks.onRegisteredSW('/sw.js', undefined)).not.toThrow()
  })
})
