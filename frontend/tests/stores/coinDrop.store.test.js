/**
 * Tests store — coinDrop (micro-interaction à l'ajout d'une transaction)
 */

import { describe, it, expect, vi } from 'vitest'
import { useCoinDropStore, COIN_DROP_DURATION } from '@/stores/coinDrop.store.js'

describe('coinDrop.store', () => {
  it('trigger ajoute une lecture', () => {
    const store = useCoinDropStore()

    store.trigger()

    expect(store.plays).toHaveLength(1)
  })

  it('chaque déclenchement a un identifiant distinct', () => {
    const store = useCoinDropStore()

    store.trigger()
    store.trigger()

    const [a, b] = store.plays.map((p) => p.id)
    expect(a).not.toBe(b)
  })

  it('retire la lecture après sa durée', () => {
    vi.useFakeTimers()
    const store = useCoinDropStore()

    store.trigger()
    vi.advanceTimersByTime(COIN_DROP_DURATION)

    expect(store.plays).toHaveLength(0)
    vi.useRealTimers()
  })

  it('un déclenchement en retire un autre déjà terminé, sans toucher aux plus récents', () => {
    vi.useFakeTimers()
    const store = useCoinDropStore()

    store.trigger()
    vi.advanceTimersByTime(COIN_DROP_DURATION)
    store.trigger()

    expect(store.plays).toHaveLength(1)
    vi.useRealTimers()
  })
})
