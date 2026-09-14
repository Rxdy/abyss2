<script setup>
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import AuthLayout    from '@/layouts/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth.store.js'
import { useAppStore }  from '@/stores/app.store.js'

const route     = useRoute()
const router    = useRouter()
const authStore = useAuthStore()
const appStore  = useAppStore()

const LAYOUTS = { default: DefaultLayout, auth: AuthLayout }
const layout  = computed(() => LAYOUTS[route.meta?.layout ?? 'default'])

// Valide le token JWT contre l'API au démarrage
async function validateSession() {
  if (!authStore.isAuthenticated) return
  try {
    const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3002'
    const res = await fetch(`${BASE_URL}/api/user`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    })
    if (res.status === 401 || res.status === 403) {
      authStore.logout()
      router.push({ name: 'login' })
    }
  } catch {
    // Pas de réseau → on laisse l'utilisateur, la redirection se fera si une requête échoue
  }
}

onMounted(async () => {
  appStore.initTheme()
  await validateSession()
})
</script>

<template>
  <component :is="layout" />
</template>

<style>
/* Transitions de page globales */
.page-enter-active,
.page-leave-active {
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}
.page-enter-from { opacity: 0; transform: translateY(8px); }
.page-leave-to   { opacity: 0; transform: translateY(-8px); }
</style>
