/**
 * Tests layout — DefaultLayout
 */

import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import DefaultLayout from '@/layouts/DefaultLayout.vue'

// Le routeur mémoire global (tests/setup.js) fournit les routes / et /profile.
function setup() {
  const wrapper = mount(DefaultLayout, {
    global: {
      // La vraie Transition, pour que ses hooks soient appelés
      stubs: { transition: false, AppHeader: true, OfflineBanner: true, UpdateBanner: true },
    },
  })
  return { router: wrapper.vm.$router, wrapper }
}

describe('DefaultLayout — défilement', () => {
  it('remet la nouvelle page en haut, au lieu de garder le défilement de la précédente', async () => {
    const { router, wrapper } = setup()
    await router.push('/')
    await flushPromises()

    const main = wrapper.find('main').element
    main.scrollTop = 600

    await router.push('/profile')
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(router.currentRoute.value.path).toBe('/profile')
    expect(main.scrollTop).toBe(0)
  })
})
