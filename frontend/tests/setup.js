/**
 * Setup global pour les tests frontend
 * - Router mémoire pour que useRouter()/RouterLink fonctionnent
 * - Pinia frais avant chaque test
 * - Storages réinitialisés (les stores lisent session/localStorage à l'init)
 */

import { beforeEach, afterEach, vi } from 'vitest'
import { config } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createPinia, setActivePinia } from 'pinia'

const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/',        name: 'home',    component: { template: '<div />' } },
    { path: '/login',   name: 'login',   component: { template: '<div />' } },
    { path: '/register', name: 'register', component: { template: '<div />' } },
    { path: '/forgot-password', name: 'forgot-password', component: { template: '<div />' } },
    { path: '/reset-password',  name: 'reset-password',  component: { template: '<div />' } },
    { path: '/profile', name: 'profile', component: { template: '<div />' } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: { template: '<div />' } },
  ],
})

config.global.plugins = [router]

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')

  const pinia = createPinia()
  setActivePinia(pinia)
  config.global.plugins = [router, pinia]
})

afterEach(() => {
  vi.restoreAllMocks()
})

export { router }
