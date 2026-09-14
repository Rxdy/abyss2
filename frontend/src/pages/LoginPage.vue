<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi.js'
import { useAuthStore } from '@/stores/auth.store.js'
import BaseInput   from '@/components/atoms/BaseInput.vue'
import BaseButton  from '@/components/atoms/BaseButton.vue'
import BaseText    from '@/components/atoms/BaseText.vue'
import ThemeToggle from '@/components/molecules/ThemeToggle.vue'

const router = useRouter()
const auth   = useAuthStore()

const email    = ref('')
const password = ref('')
const loading  = ref(false)
const errors   = ref({ email: '', password: '', global: '' })

function validate() {
  errors.value = { email: '', password: '', global: '' }
  let ok = true
  if (!email.value)    { errors.value.email    = 'L\'adresse email est requise.'; ok = false }
  if (!password.value) { errors.value.password = 'Le mot de passe est requis.';   ok = false }
  return ok
}

async function submit() {
  if (!validate()) return
  loading.value = true

  try {
    const api = useApi()
    const response = await api.post('/api/auth/login', {
      email: email.value.toLowerCase().trim(),
      password: password.value,
    })

    auth.setSession({ token: response.token, user: response.user })

    router.push({ name: 'home' })
  } catch (err) {
    errors.value.global = err.message || 'Échec de la connexion. Vérifiez vos identifiants.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-page__theme">
      <ThemeToggle />
    </div>

    <div class="auth-page__card">
      <!-- Brand -->
      <div class="auth-page__brand">
        <svg class="auth-page__logo" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" stroke-width="3" />
          <circle cx="32" cy="32" r="12" fill="currentColor" opacity="0.85" />
        </svg>
        <BaseText as="h1" size="3xl" weight="bold" color="primary">ABYSS2</BaseText>
        <BaseText as="p" size="sm" color="muted">Connectez-vous à votre espace</BaseText>
      </div>

      <!-- Erreur globale -->
      <Transition name="fade">
        <div v-if="errors.global" class="auth-page__error" role="alert">
          <BaseText size="sm" color="danger">{{ errors.global }}</BaseText>
        </div>
      </Transition>

      <!-- Formulaire -->
      <form class="auth-page__form" novalidate @submit.prevent="submit">
        <BaseInput
          v-model="email"
          id="login-email"
          type="email"
          label="Adresse email"
          placeholder="vous@exemple.com"
          :error="errors.email"
          required
          autocomplete="email"
        />

        <BaseInput
          v-model="password"
          id="login-password"
          type="password"
          label="Mot de passe"
          placeholder="••••••••"
          :error="errors.password"
          required
          autocomplete="current-password"
        />

        <BaseButton
          type="submit"
          variant="primary"
          :loading="loading"
          full
        >
          Se connecter
        </BaseButton>
      </form>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  position: relative;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-5) var(--content-padding);
  background: var(--color-bg-base);
}

.auth-page__theme {
  position: absolute;
  top: var(--space-4);
  right: var(--content-padding);
}

.auth-page__card {
  width: 100%;
  max-width: 26rem;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.auth-page__brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  text-align: center;
}

.auth-page__logo {
  width: 80px;
  height: 80px;
  color: var(--color-primary);
  filter: drop-shadow(var(--shadow-glow-primary));
}

.auth-page__error {
  background: var(--color-danger-subtle);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}

.auth-page__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* Transition fondu erreur globale */
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to       { opacity: 0; }
</style>
