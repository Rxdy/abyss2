/**
 * Tests store — auth
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from '@/stores/auth.store.js'

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('auth store', () => {
  it('démarre déconnecté quand le storage est vide', () => {
    const auth = useAuthStore()
    expect(auth.token).toBeNull()
    expect(auth.user).toBeNull()
    expect(auth.isAuthenticated).toBe(false)
  })

  it('setSession renseigne le state et le sessionStorage', () => {
    const auth = useAuthStore()
    auth.setSession({ token: 'jwt-token', user: { id: '1', email: 'a@b.c' } })

    expect(auth.isAuthenticated).toBe(true)
    expect(auth.user.email).toBe('a@b.c')
    expect(sessionStorage.getItem('abyss2_token')).toBe('jwt-token')
    expect(JSON.parse(sessionStorage.getItem('abyss2_user')).email).toBe('a@b.c')
  })

  it('logout vide le state et le sessionStorage', () => {
    const auth = useAuthStore()
    auth.setSession({ token: 'jwt-token', user: { id: '1', email: 'a@b.c' } })
    auth.logout()

    expect(auth.isAuthenticated).toBe(false)
    expect(auth.token).toBeNull()
    expect(auth.user).toBeNull()
    expect(sessionStorage.getItem('abyss2_token')).toBeNull()
    expect(sessionStorage.getItem('abyss2_user')).toBeNull()
  })

  it('restaure la session depuis le sessionStorage', () => {
    sessionStorage.setItem('abyss2_token', 'jwt-restauré')
    sessionStorage.setItem('abyss2_user', JSON.stringify({ id: '2', email: 'x@y.z' }))

    setActivePinia(createPinia())
    const auth = useAuthStore()

    expect(auth.isAuthenticated).toBe(true)
    expect(auth.user.email).toBe('x@y.z')
  })

  it('survit à un user corrompu en storage', () => {
    sessionStorage.setItem('abyss2_token', 'jwt')
    sessionStorage.setItem('abyss2_user', '{pas du json')

    setActivePinia(createPinia())
    const auth = useAuthStore()

    expect(auth.user).toBeNull()
    expect(auth.isAuthenticated).toBe(true)
  })

  it('accepte une session sans user', () => {
    const auth = useAuthStore()
    auth.setSession({ token: 'jwt' })
    expect(auth.user).toBeNull()
    expect(auth.isAuthenticated).toBe(true)
  })
})
