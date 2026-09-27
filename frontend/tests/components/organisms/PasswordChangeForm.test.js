/**
 * Tests composant — PasswordChangeForm
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import PasswordChangeForm from '@/components/organisms/PasswordChangeForm.vue'
import { useAuthStore } from '@/stores/auth.store.js'
import { useToastStore } from '@/stores/toast.store.js'

function mockFetch(body, { ok = true, status = 200 } = {}) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, status, json: async () => body })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function fill(w, { current = '', next = '', confirm = '' }) {
  await w.find('#password-current').setValue(current)
  await w.find('#password-next').setValue(next)
  await w.find('#password-confirm').setValue(confirm)
}

const submit = async (w) => {
  await w.find('form').trigger('submit')
  await flushPromises()
}

beforeEach(() => {
  vi.unstubAllGlobals()
  useAuthStore().setSession({ csrfToken: 'old-csrf', user: { id: 'u1', email: 'alice@example.com' } })
})

describe('PasswordChangeForm — validation', () => {
  it('exige le mot de passe actuel', async () => {
    const fetchMock = mockFetch({})
    const w = mount(PasswordChangeForm)

    await fill(w, { next: 'nouveau-mdp-1', confirm: 'nouveau-mdp-1' })
    await submit(w)

    expect(w.text()).toContain('Requis.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('exige 8 caractères minimum', async () => {
    const fetchMock = mockFetch({})
    const w = mount(PasswordChangeForm)

    await fill(w, { current: 'ancien', next: 'court', confirm: 'court' })
    await submit(w)

    expect(w.text()).toContain('8 caractères minimum.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('exige une confirmation identique', async () => {
    const fetchMock = mockFetch({})
    const w = mount(PasswordChangeForm)

    await fill(w, { current: 'ancien', next: 'nouveau-mdp-1', confirm: 'autre-chose' })
    await submit(w)

    expect(w.text()).toContain('Ne correspond pas au nouveau mot de passe.')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('PasswordChangeForm — annulation', () => {
  it('« Annuler » prévient le parent sans rien envoyer', async () => {
    const fetchMock = mockFetch({})
    const w = mount(PasswordChangeForm)

    await w.findAll('button').find((b) => b.text() === 'Annuler').trigger('click')

    expect(w.emitted('cancel')).toHaveLength(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('PasswordChangeForm — envoi', () => {
  it('envoie les mots de passe, garde la session avec le nouveau jeton CSRF, notifie et prévient le parent', async () => {
    const fetchMock = mockFetch({ csrfToken: 'new-csrf' })
    const w = mount(PasswordChangeForm)

    await fill(w, { current: 'ancien-mdp', next: 'nouveau-mdp-1', confirm: 'nouveau-mdp-1' })
    await submit(w)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/user\/password$/)
    expect(options.method).toBe('PUT')
    expect(JSON.parse(options.body)).toEqual({ currentPassword: 'ancien-mdp', newPassword: 'nouveau-mdp-1' })
    expect(useAuthStore().csrfToken).toBe('new-csrf')
    expect(useToastStore().items[0].message).toContain('Mot de passe modifié')
    expect(w.emitted('saved')).toHaveLength(1)
  })

  it('affiche l\'erreur de l\'API et garde l\'ancien jeton CSRF', async () => {
    mockFetch({ error: 'Mot de passe actuel incorrect.' }, { ok: false, status: 401 })
    const w = mount(PasswordChangeForm)

    await fill(w, { current: 'faux', next: 'nouveau-mdp-1', confirm: 'nouveau-mdp-1' })
    await submit(w)

    expect(w.find('[role="alert"]').text()).toContain('Mot de passe actuel incorrect.')
    expect(useAuthStore().csrfToken).toBe('old-csrf')
    expect(w.emitted('saved')).toBeUndefined()
  })
})
