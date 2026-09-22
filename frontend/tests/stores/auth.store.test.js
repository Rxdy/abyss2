/**
 * Tests store — auth
 *
 * Depuis le passage au cookie httpOnly, ce store ne porte plus de jeton : c'est le cookie, jamais
 * lisible ici, qui authentifie chaque requête (`credentials: 'include'`, voir useApi.js). Il ne
 * garde qu'un indice optimiste (`hasSession`, en localStorage — survit à la fermeture de l'app,
 * contrairement à sessionStorage) pour le garde de route, et le jeton CSRF en mémoire.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth.store.js'

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
})

describe('auth store', () => {
  it('démarre déconnecté quand le storage est vide', () => {
    const auth = useAuthStore()
    expect(auth.user).toBeNull()
    expect(auth.csrfToken).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
  })

  it('setSession renseigne le state et le localStorage (indice, pas de secret)', () => {
    const auth = useAuthStore()
    auth.setSession({ user: { id: '1', email: 'a@b.c' }, csrfToken: 'csrf-abc' })

    expect(auth.isAuthenticated).toBe(true)
    expect(auth.user.email).toBe('a@b.c')
    expect(auth.csrfToken).toBe('csrf-abc')
    expect(localStorage.getItem('abyss2_has_session')).toBe('1')
    expect(JSON.parse(localStorage.getItem('abyss2_user')).email).toBe('a@b.c')
    // Le jeton CSRF ne doit jamais être persisté (pas de secret dans le storage).
    expect(localStorage.getItem('abyss2_csrf')).toBeNull()
    expect(sessionStorage.length).toBe(0)
  })

  it('setCsrfToken remplace juste le jeton CSRF, sans toucher à la session', () => {
    const auth = useAuthStore()
    auth.setSession({ user: { id: '1', email: 'a@b.c' }, csrfToken: 'ancien' })
    auth.setCsrfToken('nouveau')

    expect(auth.csrfToken).toBe('nouveau')
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.user.email).toBe('a@b.c')
  })

  it('logout appelle /api/auth/logout puis vide le state et le localStorage', async () => {
    const auth = useAuthStore()
    auth.setSession({ user: { id: '1', email: 'a@b.c' }, csrfToken: 'csrf-abc' })

    await auth.logout()

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/logout'),
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    )
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.user).toBeNull()
    expect(auth.csrfToken).toBeNull()
    expect(localStorage.getItem('abyss2_has_session')).toBeNull()
    expect(localStorage.getItem('abyss2_user')).toBeNull()
  })

  it('logout vide quand même l\'état local si la requête réseau échoue', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const auth = useAuthStore()
    auth.setSession({ user: { id: '1', email: 'a@b.c' }, csrfToken: 'csrf-abc' })

    await expect(auth.logout()).resolves.toBeUndefined()

    expect(auth.isAuthenticated).toBe(false)
    expect(auth.user).toBeNull()
  })

  it('restaure l\'indice de session et l\'utilisateur depuis le localStorage', () => {
    localStorage.setItem('abyss2_has_session', '1')
    localStorage.setItem('abyss2_user', JSON.stringify({ id: '2', email: 'x@y.z' }))

    setActivePinia(createPinia())
    const auth = useAuthStore()

    expect(auth.isAuthenticated).toBe(true)
    expect(auth.user.email).toBe('x@y.z')
    // Le jeton CSRF, lui, ne survit jamais à un rechargement : il n'a jamais été persisté.
    expect(auth.csrfToken).toBeNull()
  })

  it('survit à un user corrompu en storage', () => {
    localStorage.setItem('abyss2_has_session', '1')
    localStorage.setItem('abyss2_user', '{pas du json')

    setActivePinia(createPinia())
    const auth = useAuthStore()

    expect(auth.user).toBeNull()
    expect(auth.isAuthenticated).toBe(true)
  })

  it('accepte une session sans user (juste une confirmation de session)', () => {
    const auth = useAuthStore()
    auth.setSession({ csrfToken: 'csrf-abc' })
    expect(auth.user).toBeNull()
    expect(auth.isAuthenticated).toBe(true)
  })
})
