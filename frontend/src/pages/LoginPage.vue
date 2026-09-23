<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi.js'
import { useAuthStore } from '@/stores/auth.store.js'
import BaseInput   from '@/components/atoms/BaseInput.vue'
import BaseButton  from '@/components/atoms/BaseButton.vue'
import AlertBanner from '@/components/molecules/AlertBanner.vue'
import AuthShell   from '@/components/organisms/AuthShell.vue'

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

    auth.setSession({ user: response.user, csrfToken: response.csrfToken })

    router.push({ name: 'home' })
  } catch (err) {
    errors.value.global = err.message || 'Échec de la connexion. Vérifiez vos identifiants.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell subtitle="Connectez-vous à votre espace">
    <Transition name="fade">
      <AlertBanner v-if="errors.global">{{ errors.global }}</AlertBanner>
    </Transition>

    <form class="auth-form" novalidate @submit.prevent="submit">
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

      <RouterLink class="auth-form__forgot" :to="{ name: 'forgot-password' }">
        Mot de passe oublié ?
      </RouterLink>

      <BaseButton
        type="submit"
        variant="primary"
        :loading="loading"
        full
      >
        Se connecter
      </BaseButton>
    </form>

    <template #footer>
      Pas encore de compte ? <RouterLink :to="{ name: 'register' }">Créer un compte</RouterLink>
    </template>
  </AuthShell>
</template>

<style scoped>
.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.auth-form__forgot {
  align-self: flex-end;
  margin-top: calc(-1 * var(--space-2));
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  text-decoration: none;
}

.auth-form__forgot:hover {
  color: var(--color-accent);
  text-decoration: underline;
}

/* Transition fondu erreur globale */
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to       { opacity: 0; }
</style>
