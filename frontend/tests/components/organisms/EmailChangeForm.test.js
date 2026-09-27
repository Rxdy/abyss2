/**
 * Tests composant — EmailChangeForm (Gestion du compte)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import EmailChangeForm from '@/components/organisms/EmailChangeForm.vue'
import { useAuthStore } from '@/stores/auth.store.js'
import { useToastStore } from '@/stores/toast.store.js'
import { mockApi, calls } from '../../stores/_helpers.js'

beforeEach(() => {
  vi.unstubAllGlobals()
  useAuthStore().setSession({ csrfToken: 'csrf-old', user: { id: 'u1', email: 'alice@example.com', currency: 'EUR' } })
})

async function fill(w, email, password) {
  await w.find('#email-new').setValue(email)
  await w.find('#email-password').setValue(password)
  await w.find('form').trigger('submit')
  await flushPromises()
}

describe('EmailChangeForm', () => {
  it('change l\'adresse : envoie email + mot de passe, met à jour la session, vide le formulaire', async () => {
    const fetchMock = mockApi(() => ({ body: { email: 'alice.new@example.com', csrfToken: 'csrf-new' } }))
    const w = mount(EmailChangeForm)

    await fill(w, '  alice.new@example.com ', 'secret')

    expect(calls(fetchMock)).toEqual([{ method: 'PUT', path: '/api/user/email', body: { email: 'alice.new@example.com', password: 'secret' } }])
    const auth = useAuthStore()
    expect(auth.user.email).toBe('alice.new@example.com')
    expect(auth.csrfToken).toBe('csrf-new')
    expect(w.find('#email-new').element.value).toBe('')
    expect(useToastStore().items[0].message).toContain('Adresse email modifiée')
    expect(w.emitted('saved')[0]).toEqual(['alice.new@example.com'])
  })

  it('valide avant d\'appeler l\'API : adresse invalide, identique, mot de passe manquant', async () => {
    const fetchMock = mockApi(() => ({ body: {} }))
    const w = mount(EmailChangeForm)

    await fill(w, 'pas-une-adresse', '')
    expect(w.text()).toContain('Adresse email invalide.')
    expect(w.text()).toContain('Requis pour confirmer.')

    await fill(w, 'ALICE@example.com', 'secret')
    expect(w.text()).toContain('C\'est déjà l\'adresse de ce compte.')

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('erreur de l\'API (mot de passe faux, adresse prise) : affichée, session intacte', async () => {
    mockApi(() => ({ ok: false, status: 409, body: { error: 'Cette adresse email est déjà utilisée.' } }))
    const w = mount(EmailChangeForm)

    await fill(w, 'bob@example.com', 'secret')

    expect(w.find('[role="alert"]').text()).toContain('déjà utilisée')
    expect(useAuthStore().user.email).toBe('alice@example.com')
  })
})
