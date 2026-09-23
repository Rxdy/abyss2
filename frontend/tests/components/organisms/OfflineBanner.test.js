/**
 * Tests composant — OfflineBanner
 */

import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import OfflineBanner from '@/components/organisms/OfflineBanner.vue'

function setOnline(value) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
}

let wrapper
afterEach(() => wrapper?.unmount())

describe('OfflineBanner', () => {
  it('ne s\'affiche pas en ligne', () => {
    setOnline(true)
    wrapper = mount(OfflineBanner)

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('prévient quand l\'app démarre hors ligne', () => {
    setOnline(false)
    wrapper = mount(OfflineBanner)

    expect(wrapper.find('[role="alert"]').text()).toContain('hors ligne')
  })

  it('apparaît et disparaît avec les événements réseau', async () => {
    setOnline(true)
    wrapper = mount(OfflineBanner)

    setOnline(false)
    window.dispatchEvent(new Event('offline'))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)

    setOnline(true)
    window.dispatchEvent(new Event('online'))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })
})
