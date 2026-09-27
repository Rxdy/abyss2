/**
 * Tests store — toast (notifications éphémères)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useToastStore, TOAST_DURATION } from '@/stores/toast.store.js'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('toast.store', () => {
  it('ajoute une notification de succès', () => {
    const toasts = useToastStore()

    toasts.success('Transaction ajoutée.')

    expect(toasts.items).toHaveLength(1)
    expect(toasts.items[0]).toMatchObject({ message: 'Transaction ajoutée.', tone: 'success' })
  })

  it('la retire toute seule après la durée par défaut', () => {
    const toasts = useToastStore()
    toasts.success('Ok')

    vi.advanceTimersByTime(TOAST_DURATION - 1)
    expect(toasts.items).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(toasts.items).toHaveLength(0)
  })

  it('dismiss retire uniquement la notification ciblée', () => {
    const toasts = useToastStore()
    const first = toasts.success('Une')
    toasts.success('Deux')

    toasts.dismiss(first)

    expect(toasts.items.map((t) => t.message)).toEqual(['Deux'])
  })

  it('duration 0 : reste affichée jusqu\'à la fermeture manuelle', () => {
    const toasts = useToastStore()
    toasts.push('Important', { duration: 0 })

    vi.advanceTimersByTime(TOAST_DURATION * 10)

    expect(toasts.items).toHaveLength(1)
  })

  it('donne un identifiant distinct à chaque notification', () => {
    const toasts = useToastStore()
    expect(toasts.success('a')).not.toBe(toasts.success('a'))
  })
})
