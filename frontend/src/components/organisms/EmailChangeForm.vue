<script setup>
/*
 * Changement d'adresse email (Gestion du compte). Le mot de passe est redemandé ; le serveur
 * déconnecte les autres appareils et ré-émet la session de celui-ci (nouveau jeton CSRF).
 */
import { ref } from 'vue'
import { useApi } from '@/composables/useApi.js'
import { useAuthStore } from '@/stores/auth.store.js'
import { useToastStore } from '@/stores/toast.store.js'
import BaseButton  from '@/components/atoms/BaseButton.vue'
import BaseInput   from '@/components/atoms/BaseInput.vue'
import AlertBanner from '@/components/molecules/AlertBanner.vue'

const emit = defineEmits(['saved'])

const auth   = useAuthStore()
const toasts = useToastStore()
const api    = useApi()

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const noErrors = () => ({ email: '', password: '', global: '' })
const form    = ref({ email: '', password: '' })
const errors  = ref(noErrors())
const loading = ref(false)

async function submit() {
  errors.value = noErrors()
  const email = form.value.email.trim()

  if (!EMAIL_PATTERN.test(email)) errors.value.email = 'Adresse email invalide.'
  else if (email.toLowerCase() === auth.user?.email?.toLowerCase()) errors.value.email = 'C\'est déjà l\'adresse de ce compte.'
  if (!form.value.password) errors.value.password = 'Requis pour confirmer.'
  if (errors.value.email || errors.value.password) return

  loading.value = true
  try {
    const response = await api.put('/api/user/email', { email, password: form.value.password })
    auth.setCsrfToken(response.csrfToken)
    auth.updateUser({ email: response.email })
    form.value = { email: '', password: '' }
    toasts.success('Adresse email modifiée. Vos autres appareils ont été déconnectés.', { duration: 6000 })
    emit('saved', response.email)
  } catch (err) {
    errors.value.global = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="email-change" novalidate @submit.prevent="submit">
    <AlertBanner v-if="errors.global">{{ errors.global }}</AlertBanner>

    <BaseInput
      v-model="form.email"
      id="email-new"
      type="email"
      label="Nouvelle adresse email"
      autocomplete="email"
      :error="errors.email"
      required
    />

    <BaseInput
      v-model="form.password"
      id="email-password"
      type="password"
      label="Mot de passe actuel"
      autocomplete="current-password"
      :error="errors.password"
      required
    />

    <BaseButton type="submit" variant="primary" :loading="loading" full>
      Changer l'adresse email
    </BaseButton>
  </form>
</template>

<style scoped>
.email-change {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
</style>
