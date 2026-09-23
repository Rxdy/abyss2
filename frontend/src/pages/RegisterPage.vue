<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi.js'
import { useAuthStore } from '@/stores/auth.store.js'
import { PASSWORD_MIN, PASSWORD_MAX, REQUIRED_LEVEL, STRENGTH_LEVELS, evaluatePassword } from '@/utils/passwordStrength.js'
import BaseInput    from '@/components/atoms/BaseInput.vue'
import BaseButton   from '@/components/atoms/BaseButton.vue'
import AlertBanner  from '@/components/molecules/AlertBanner.vue'
import PasswordStrengthMeter from '@/components/molecules/PasswordStrengthMeter.vue'
import AuthShell    from '@/components/organisms/AuthShell.vue'

const router = useRouter()
const auth   = useAuthStore()

const email    = ref('')
const password = ref('')
const confirm  = ref('')
const loading  = ref(false)

const strength = computed(() => evaluatePassword(password.value))
const errors   = ref({ email: '', password: '', confirm: '', global: '' })

function validate() {
  errors.value = { email: '', password: '', confirm: '', global: '' }
  let ok = true

  if (!email.value.trim()) {
    errors.value.email = 'L\'adresse email est requise.'
    ok = false
  } else if (!/^\S+@\S+\.\S+$/.test(email.value.trim())) {
    errors.value.email = 'Cette adresse email n\'est pas valide.'
    ok = false
  }

  if (password.value.length < PASSWORD_MIN) {
    errors.value.password = `Le mot de passe doit contenir au moins ${PASSWORD_MIN} caractères.`
    ok = false
  } else if (password.value.length > PASSWORD_MAX) {
    errors.value.password = `Le mot de passe ne peut pas dépasser ${PASSWORD_MAX} caractères.`
    ok = false
  } else if (!strength.value.acceptable) {
    errors.value.password =
      `Mot de passe trop faible (« ${strength.value.label} », ${strength.value.percent} %) : `
      + `le niveau « ${STRENGTH_LEVELS[REQUIRED_LEVEL].label} » est requis.`
    ok = false
  }

  if (confirm.value !== password.value) {
    errors.value.confirm = 'Les deux mots de passe ne correspondent pas.'
    ok = false
  }

  return ok
}

async function submit() {
  if (!validate()) return
  loading.value = true

  try {
    const api   = useApi()
    const creds = { email: email.value.toLowerCase().trim(), password: password.value }

    await api.post('/api/auth/register', creds)

    // Compte créé : on connecte directement, sans repasser par la page de login
    const session = await api.post('/api/auth/login', creds)
    auth.setSession({ user: session.user, csrfToken: session.csrfToken })

    router.push({ name: 'home' })
  } catch (err) {
    errors.value.global = err.message || 'Impossible de créer le compte. Réessayez.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell subtitle="Créez votre espace">
    <Transition name="fade">
      <AlertBanner v-if="errors.global">{{ errors.global }}</AlertBanner>
    </Transition>

    <form class="auth-form" novalidate @submit.prevent="submit">
      <BaseInput
        v-model="email"
        id="register-email"
        type="email"
        label="Adresse email"
        placeholder="vous@exemple.com"
        :error="errors.email"
        required
        autocomplete="email"
      />

      <div class="auth-form__password">
        <BaseInput
          v-model="password"
          id="register-password"
          type="password"
          label="Mot de passe"
          placeholder="Choisissez un mot de passe solide"
          :error="errors.password"
          required
          autocomplete="new-password"
        />
        <PasswordStrengthMeter :password="password" />
      </div>

      <BaseInput
        v-model="confirm"
        id="register-confirm"
        type="password"
        label="Confirmer le mot de passe"
        placeholder="••••••••"
        :error="errors.confirm"
        required
        autocomplete="new-password"
      />

      <BaseButton type="submit" variant="primary" :loading="loading" full>
        Créer mon compte
      </BaseButton>
    </form>

    <template #footer>
      Déjà un compte ? <RouterLink :to="{ name: 'login' }">Se connecter</RouterLink>
    </template>
  </AuthShell>
</template>

<style scoped>
.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.auth-form__password {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to       { opacity: 0; }
</style>
