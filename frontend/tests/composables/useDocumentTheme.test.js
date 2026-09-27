/**
 * Tests composable — useDocumentTheme
 */

import { describe, it, expect, afterEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { useDocumentTheme } from '@/composables/useDocumentTheme.js'

const Probe = defineComponent({
  setup() {
    const theme = useDocumentTheme()
    return () => h('span', theme.value)
  },
})

let wrapper
afterEach(() => wrapper?.unmount())

describe('useDocumentTheme', () => {
  it('lit le thème posé sur <html>', () => {
    document.documentElement.setAttribute('data-theme', 'light')
    wrapper = mount(Probe)

    expect(wrapper.text()).toBe('light')
  })

  it('prend « dark » par défaut', () => {
    wrapper = mount(Probe)

    expect(wrapper.text()).toBe('dark')
  })

  it('suit les changements de thème en direct', async () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    wrapper = mount(Probe)

    document.documentElement.setAttribute('data-theme', 'light')
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toBe('light')
  })
})
