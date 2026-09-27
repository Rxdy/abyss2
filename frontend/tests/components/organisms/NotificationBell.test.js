/**
 * Tests composant — NotificationBell
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import NotificationBell from '@/components/organisms/NotificationBell.vue'
import { useAuthStore } from '@/stores/auth.store.js'
import { router } from '../../setup.js'
import { mockApi } from '../../stores/_helpers.js'

beforeEach(() => {
  vi.unstubAllGlobals()
  useAuthStore().setSession({ csrfToken: 'csrf-abc', user: { id: 'u1', email: 'alice@example.com' } })
})

describe('NotificationBell', () => {
  it('charge le compte non lu au montage', async () => {
    mockApi(() => ({ body: { count: 3 } }))
    const w = mount(NotificationBell)
    await flushPromises()

    expect(w.text()).toContain('3')
  })

  it('aucune notification non lue : pas de badge', async () => {
    mockApi(() => ({ body: { count: 0 } }))
    const w = mount(NotificationBell)
    await flushPromises()

    expect(w.find('.notification-bell__badge').exists()).toBe(false)
  })

  it('plus de 9 non lues : affiche « 9+ »', async () => {
    mockApi(() => ({ body: { count: 42 } }))
    const w = mount(NotificationBell)
    await flushPromises()

    expect(w.text()).toContain('9+')
  })

  it('clic sur la cloche mène à /notifications', async () => {
    mockApi(() => ({ body: { count: 0 } }))
    const push = vi.spyOn(router, 'push').mockResolvedValue()
    const w = mount(NotificationBell)
    await flushPromises()

    await w.find('button').trigger('click')

    expect(push).toHaveBeenCalledWith('/notifications')
  })

  it('rafraîchit le compte à chaque changement de page', async () => {
    let count = 1
    mockApi(() => ({ body: { count } }))
    await router.push('/')
    const w = mount(NotificationBell)
    await flushPromises()
    expect(w.text()).toContain('1')

    count = 2
    await router.push('/profile')
    await flushPromises()

    expect(w.text()).toContain('2')
  })

  it('non authentifié : ne fait aucun appel (évite un 401 pendant la résolution initiale du routeur)', async () => {
    useAuthStore().hasSession = false
    const fetchMock = mockApi(() => ({ body: { count: 5 } }))

    mount(NotificationBell)
    await flushPromises()

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
