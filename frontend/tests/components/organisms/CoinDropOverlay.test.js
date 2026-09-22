/**
 * Tests composant — CoinDropOverlay
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CoinDropOverlay from '@/components/organisms/CoinDropOverlay.vue'
import CoinDropIcon from '@/components/atoms/CoinDropIcon.vue'
import { useCoinDropStore } from '@/stores/coinDrop.store.js'

describe('CoinDropOverlay', () => {
  it('vide au repos', () => {
    const w = mount(CoinDropOverlay)

    expect(w.find('svg').exists()).toBe(false)
  })

  it('monte une icône par déclenchement du store', async () => {
    const w = mount(CoinDropOverlay)

    useCoinDropStore().trigger()
    await w.vm.$nextTick()

    expect(w.findAll('svg')).toHaveLength(1)
  })

  it('plusieurs déclenchements superposent plusieurs icônes', async () => {
    const w = mount(CoinDropOverlay)
    const store = useCoinDropStore()

    store.trigger()
    store.trigger()
    await w.vm.$nextTick()

    expect(w.findAll('svg')).toHaveLength(2)
  })

  it('la lecture terminée retire le composant du DOM', async () => {
    const w = mount(CoinDropOverlay)
    const store = useCoinDropStore()

    store.trigger()
    await w.vm.$nextTick()
    store.plays = []
    await w.vm.$nextTick()

    expect(w.findComponent(CoinDropIcon).exists()).toBe(false)
  })
})
