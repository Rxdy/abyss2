/**
 * Tests composant — UpdateBanner
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import UpdateBanner from '@/components/organisms/UpdateBanner.vue'
import { registerPwaUpdates, resetPwaUpdate } from '@/composables/usePwaUpdate.js'

let callbacks
let updateSW

beforeEach(() => {
  resetPwaUpdate()
  updateSW = vi.fn()
  registerPwaUpdates((cb) => { callbacks = cb; return updateSW })
})

const button = (w, label) => w.findAll('button').find((b) => b.text() === label)

describe('UpdateBanner', () => {
  it('invisible tant qu\'il n\'y a pas de nouvelle version', () => {
    expect(mount(UpdateBanner).find('.update-banner').exists()).toBe(false)
  })

  it('apparaît dès qu\'une nouvelle version est prête', async () => {
    const w = mount(UpdateBanner)

    callbacks.onNeedRefresh()
    await w.vm.$nextTick()

    expect(w.text()).toContain('Une nouvelle version d\'Abyss2 est disponible.')
  })

  it('est annoncée poliment (status), pas comme une alerte qui interrompt', async () => {
    const w = mount(UpdateBanner)
    callbacks.onNeedRefresh()
    await w.vm.$nextTick()

    expect(w.find('.update-banner').attributes('role')).toBe('status')
  })

  it('« Mettre à jour » active la nouvelle version', async () => {
    const w = mount(UpdateBanner)
    callbacks.onNeedRefresh()
    await w.vm.$nextTick()

    await button(w, 'Mettre à jour').trigger('click')

    expect(updateSW).toHaveBeenCalledWith(true)
  })

  it('« Plus tard » la masque sans rien activer', async () => {
    const w = mount(UpdateBanner)
    callbacks.onNeedRefresh()
    await w.vm.$nextTick()

    await button(w, 'Plus tard').trigger('click')

    expect(w.find('.update-banner').exists()).toBe(false)
    expect(updateSW).not.toHaveBeenCalled()
  })
})
