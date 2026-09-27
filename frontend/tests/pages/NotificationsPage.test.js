/**
 * Tests page — NotificationsPage (onglets, lecture, archivage, suppression)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import NotificationsPage from '@/pages/NotificationsPage.vue'
import { useToastStore } from '@/stores/toast.store.js'
import { mockApi, calls } from '../stores/_helpers.js'
import { router } from '../setup.js'

const notif = (id, extra = {}) => ({
  id, type: 'envelope_overspend', title: 'Enveloppe dépassée', message: 'x',
  envelopeId: null, count: null, read: false, archived: false, createdAt: '2026-09-20T10:00:00.000Z',
  ...extra,
})

let wrapper
async function mountPage(active = [notif('n1')], handler = () => ({ body: {} })) {
  const fetchMock = mockApi((req) => {
    if (req.method === 'GET' && req.url.searchParams.get('archived') === 'true')  return { body: [] }
    if (req.method === 'GET') return { body: active }
    return handler(req)
  })
  wrapper = mount(NotificationsPage, { attachTo: document.body })
  await flushPromises()
  return fetchMock
}

const rows = () => wrapper.findAll('li.notification')
const chip = (label) => wrapper.findAll('button').find((b) => b.text() === label)

beforeEach(() => vi.unstubAllGlobals())
afterEach(() => wrapper?.unmount())

describe('NotificationsPage — affichage', () => {
  it('liste les notifications actives par défaut', async () => {
    await mountPage()

    expect(rows()).toHaveLength(1)
    expect(wrapper.text()).toContain('Enveloppe dépassée')
  })

  it('sans notification : message vide', async () => {
    await mountPage([])

    expect(wrapper.text()).toContain('Aucune notification pour l\'instant.')
  })

  it('onglet Archivées : recharge avec archived=true', async () => {
    const fetchMock = await mountPage()

    await chip('Archivées').trigger('click')
    await flushPromises()

    expect(calls(fetchMock).at(-1).path).toBe('/api/notifications?archived=true')
  })
})

describe('NotificationsPage — lecture', () => {
  it('ouvrir une notification non lue la marque lue', async () => {
    const fetchMock = await mountPage([notif('n1')], (req) => {
      if (req.method === 'PUT') return { body: notif('n1', { read: true }) }
      return { body: {} }
    })

    await wrapper.find('.notification__main').trigger('click')
    await flushPromises()

    const put = calls(fetchMock).find((c) => c.method === 'PUT')
    expect(put).toMatchObject({ path: '/api/notifications/n1', body: { read: true } })
  })

  it('déjà lue : aucun appel PUT', async () => {
    const fetchMock = await mountPage([notif('n1', { read: true })])

    await wrapper.find('.notification__main').trigger('click')
    await flushPromises()

    expect(calls(fetchMock).some((c) => c.method === 'PUT')).toBe(false)
  })
})

describe('NotificationsPage — ouverture', () => {
  it.each([
    ['envelope_overspend', '/profile/envelopes'],
    ['negative_balance', '/'],
    ['uncategorized_digest', { path: '/transactions', query: { category: 'none', type: 'expense' } }],
  ])('ouvrir « %s » mène à l\'écran concerné', async (type, target) => {
    await mountPage([notif('n1', { type, read: true })])
    const push = vi.spyOn(router, 'push').mockResolvedValue()

    await wrapper.find('.notification__main').trigger('click')
    await flushPromises()

    expect(push).toHaveBeenCalledWith(target)
  })

  it('non lue : la marque lue avant de naviguer', async () => {
    const fetchMock = await mountPage([notif('n1')], (req) => (req.method === 'PUT' ? { body: notif('n1', { read: true }) } : { body: {} }))
    const push = vi.spyOn(router, 'push').mockResolvedValue()

    await wrapper.find('.notification__main').trigger('click')
    await flushPromises()

    expect(calls(fetchMock).some((c) => c.method === 'PUT')).toBe(true)
    expect(push).toHaveBeenCalledWith('/profile/envelopes')
  })
})

describe('NotificationsPage — tout marquer comme lu', () => {
  const readAllButton = () => wrapper.findAll('button').find((b) => b.text() === 'Tout marquer comme lu')

  it('des non lues : le bouton marque tout comme lu', async () => {
    const fetchMock = await mountPage([notif('n1'), notif('n2')], () => ({ body: { updated: 2 } }))

    await readAllButton().trigger('click')
    await flushPromises()

    expect(calls(fetchMock).some((c) => c.method === 'POST' && c.path === '/api/notifications/read-all')).toBe(true)
    expect(wrapper.find('.notification__dot').exists()).toBe(false)
    expect(readAllButton()).toBeUndefined()
    expect(useToastStore().items[0].message).toBe('Toutes les notifications sont lues.')
  })

  it('tout est déjà lu : pas de bouton', async () => {
    await mountPage([notif('n1', { read: true })])
    expect(readAllButton()).toBeUndefined()
  })
})

describe('NotificationsPage — archivage et suppression', () => {
  it('archiver retire la ligne et notifie', async () => {
    await mountPage([notif('n1')], (req) => (req.method === 'PUT' ? { body: {} } : { body: {} }))

    await wrapper.find('button[aria-label="Archiver"]').trigger('click')
    await flushPromises()

    expect(rows()).toHaveLength(0)
    expect(useToastStore().items[0].message).toBe('Notification archivée.')
  })

  it('supprimer retire la ligne et notifie', async () => {
    await mountPage([notif('n1')], (req) => (req.method === 'DELETE' ? { body: { deleted: true } } : { body: {} }))

    await wrapper.find('button[aria-label="Supprimer"]').trigger('click')
    await flushPromises()

    expect(rows()).toHaveLength(0)
    expect(useToastStore().items[0].message).toBe('Notification supprimée.')
  })
})
