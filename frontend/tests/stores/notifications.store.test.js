/**
 * Tests store — notifications (badge non lu, CRUD)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useNotificationsStore } from '@/stores/notifications.store.js'
import { useToastStore } from '@/stores/toast.store.js'
import { mockApi, calls } from './_helpers.js'

const notif = (id, extra = {}) => ({
  id, type: 'envelope_overspend', title: 'Enveloppe dépassée', message: 'x',
  envelopeId: null, count: null, read: false, archived: false, createdAt: '2026-09-20T10:00:00.000Z',
  ...extra,
})

beforeEach(() => vi.unstubAllGlobals())

describe('notifications.store — compte non lu', () => {
  it('fetchUnreadCount renseigne le compteur', async () => {
    mockApi(() => ({ body: { count: 4 } }))
    const store = useNotificationsStore()

    await store.fetchUnreadCount()

    expect(store.unreadCount).toBe(4)
  })

  it('en cas d\'échec réseau : garde la dernière valeur connue, ne lève pas', async () => {
    mockApi(() => ({ ok: false, status: 500, body: { error: 'boom' } }))
    const store = useNotificationsStore()
    store.unreadCount = 2

    await expect(store.fetchUnreadCount()).resolves.toBe(2)
    expect(store.unreadCount).toBe(2)
  })
})

describe('notifications.store — liste', () => {
  it('fetchAll charge les notifications actives par défaut', async () => {
    const fetchMock = mockApi(() => ({ body: [notif('n1')] }))
    const store = useNotificationsStore()

    await store.fetchAll()

    expect(calls(fetchMock)[0].path).toBe('/api/notifications?archived=false')
    expect(store.items).toHaveLength(1)
    expect(store.loaded).toBe(true)
  })

  it('fetchAll({ archived: true }) charge les archivées', async () => {
    const fetchMock = mockApi(() => ({ body: [] }))
    const store = useNotificationsStore()

    await store.fetchAll({ archived: true })

    expect(calls(fetchMock)[0].path).toBe('/api/notifications?archived=true')
  })

  it('expose l\'erreur en cas d\'échec', async () => {
    mockApi(() => ({ ok: false, status: 500, body: { error: 'Erreur serveur.' } }))
    const store = useNotificationsStore()

    await expect(store.fetchAll()).rejects.toThrow('Erreur serveur.')
    expect(store.error).toBe('Erreur serveur.')
  })
})

describe('notifications.store — markRead', () => {
  it('marque lue et décrémente le compteur si elle était non lue', async () => {
    const fetchMock = mockApi(() => ({ body: notif('n1', { read: true }) }))
    const store = useNotificationsStore()
    store.items = [notif('n1')]
    store.unreadCount = 5

    await store.markRead('n1')

    expect(calls(fetchMock)[0]).toMatchObject({ method: 'PUT', path: '/api/notifications/n1', body: { read: true } })
    expect(store.items[0].read).toBe(true)
    expect(store.unreadCount).toBe(4)
  })

  it('déjà lue : ne décrémente pas une seconde fois', async () => {
    mockApi(() => ({ body: notif('n1', { read: true }) }))
    const store = useNotificationsStore()
    store.items = [notif('n1', { read: true })]
    store.unreadCount = 5

    await store.markRead('n1')

    expect(store.unreadCount).toBe(5)
  })
})

describe('notifications.store — archive / remove', () => {
  it('archive retire la notification de la liste et décrémente si non lue', async () => {
    mockApi(() => ({ body: {} }))
    const store = useNotificationsStore()
    store.items = [notif('n1'), notif('n2')]
    store.unreadCount = 2

    await store.archive('n1')

    expect(store.items.map((n) => n.id)).toEqual(['n2'])
    expect(store.unreadCount).toBe(1)
  })

  it('remove appelle DELETE et retire la notification', async () => {
    const fetchMock = mockApi(() => ({ body: { deleted: true } }))
    const store = useNotificationsStore()
    store.items = [notif('n1')]
    store.unreadCount = 1

    await store.remove('n1')

    expect(calls(fetchMock)[0]).toMatchObject({ method: 'DELETE', path: '/api/notifications/n1' })
    expect(store.items).toEqual([])
    expect(store.unreadCount).toBe(0)
  })

  it('archiver/supprimer une notification déjà lue ne descend pas le compteur sous zéro', async () => {
    mockApi(() => ({ body: {} }))
    const store = useNotificationsStore()
    store.items = [notif('n1', { read: true })]
    store.unreadCount = 0

    await store.archive('n1')

    expect(store.unreadCount).toBe(0)
  })
})

describe('notifications.store — après une écriture de transactions', () => {
  it('nouvelles notifications : met à jour le badge et les annonce en toast', async () => {
    mockApi(({ url }) => (url.pathname.endsWith('/unread-count')
      ? { body: { count: 3 } }
      : { body: [
          notif('n3', { message: 'Votre solde est passé sous zéro.' }),
          notif('n2', { message: 'L\'enveloppe « Courses » a dépassé son plafond mensuel.' }),
          notif('n1', { message: 'ancienne' }),
        ] }))
    const store = useNotificationsStore()
    store.unreadCount = 1

    await store.refreshAfterChange()

    expect(store.unreadCount).toBe(3)
    expect(useToastStore().items.map((t) => [t.message, t.tone])).toEqual([
      ['Votre solde est passé sous zéro.', 'danger'],
      ['L\'enveloppe « Courses » a dépassé son plafond mensuel.', 'danger'],
    ])
  })

  it('rien de nouveau : ne recharge pas la liste, aucun toast', async () => {
    const fetchMock = mockApi(() => ({ body: { count: 2 } }))
    const store = useNotificationsStore()
    store.unreadCount = 2

    await store.refreshAfterChange()

    expect(calls(fetchMock).map((c) => c.path)).toEqual(['/api/notifications/unread-count'])
    expect(useToastStore().items).toHaveLength(0)
  })

  it('réponse inattendue du compteur : garde la valeur connue', async () => {
    mockApi(() => ({ body: {} }))
    const store = useNotificationsStore()
    store.unreadCount = 2

    await store.fetchUnreadCount()

    expect(store.unreadCount).toBe(2)
  })
})

describe('notifications.store — tout marquer comme lu', () => {
  it('appelle read-all, passe les lignes en lues et remet le badge à zéro', async () => {
    const fetchMock = mockApi(() => ({ body: { updated: 2 } }))
    const store = useNotificationsStore()
    store.items = [notif('n1'), notif('n2'), notif('n3', { read: true })]
    store.unreadCount = 2

    await store.markAllRead()

    expect(calls(fetchMock)).toEqual([{ method: 'POST', path: '/api/notifications/read-all', body: undefined }])
    expect(store.items.every((n) => n.read)).toBe(true)
    expect(store.unreadCount).toBe(0)
  })

  it('échec : lève et ne touche à rien', async () => {
    mockApi(() => ({ ok: false, status: 500, body: { error: 'boom' } }))
    const store = useNotificationsStore()
    store.items = [notif('n1')]
    store.unreadCount = 1

    await expect(store.markAllRead()).rejects.toThrow('boom')
    expect(store.items[0].read).toBe(false)
    expect(store.unreadCount).toBe(1)
  })
})
