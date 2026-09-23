<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi.js'
import { useAuthStore } from '@/stores/auth.store.js'
import { PASSWORD_MIN, PASSWORD_MAX, REQUIRED_LEVEL, STRENGTH_LEVELS, evaluatePassword } from '@/utils/passwordStrength.js'
import BaseInput    from '@/components/atoms/BaseInput.vue'
import BaseButton   from '@/components/atoms/BaseButton.vue'
import BaseText     from '@/components/atoms/BaseText.vue'
import AlertBanner  from '@/components/molecules/AlertBanner.vue'
import PasswordStrengthMeter from '@/components/molecules/PasswordStrengthMeter.vue'
import AuthShell    from '@/components/organisms/AuthShell.vue'

const route  = useRoute()
const router = useRouter()
const auth   = useAuthStore()

// Le jeton vient du lien envoyé par email (voir ForgotPasswordPage) : une simple chaîne dans
// l'URL, jamais lu ni stocké ailleurs — il n'a de sens qu'une fois soumis à l'API.
const token = typeof route.query.token === 'string' ? route.query.token : ''

const password = ref('')
const confirm  = ref('')
const loading  = ref(false)
const done     = ref(false)

const strength = computed(() => evaluatePassword(password.value))
const errors   = ref({ password: '', confirm: '', global: '' })

function validate() {
  errors.value = { password: '', confirm: '', global: '' }
  let ok = true

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
    const api = useApi()
    await api.post('/api/auth/reset-password', { token, newPassword: password.value })

    // Le lien vient de prouver que cet appareil contrôle la boîte mail : l'API a déjà ouvert une
    // session (cookie httpOnly) — un GET /api/user classique complète le store (email, jeton CSRF),
    // exactement comme au démarrage de l'app (voir App.vue).
    const profile = await api.get('/api/user')
    auth.setSession({ user: { id: profile.id, email: profile.email }, csrfToken: profile.csrfToken })

    done.value = true
    setTimeout(() => router.push({ name: 'home' }), 1500)
  } catch (err) {
    errors.value.global = err.message || 'Impossible de réinitialiser le mot de passe. Réessayez.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell subtitle="Nouveau mot de passe">
    <template v-if="!token">
      <AlertBanner>Ce lien de réinitialisation est incomplet ou invalide.</AlertBanner>
      <BaseText size="sm" color="secondary">
        Demandez-en un nouveau depuis la page de connexion.
      </BaseText>
    </template>

    <template v-else-if="done">
      <BaseText size="sm" color="secondary">
        Mot de passe modifié. Vous allez être redirigé…
      </BaseText>
    </template>

    <form v-else class="auth-form" novalidate @submit.prevent="submit">
      <Transition name="fade">
        <AlertBanner v-if="errors.global">{{ errors.global }}</AlertBanner>
      </Transition>

      <div class="auth-form__password">
        <BaseInput
          v-model="password"
          id="reset-password"
          type="password"
          label="Nouveau mot de passe"
          placeholder="Choisissez un mot de passe solide"
          :error="errors.password"
          required
          autocomplete="new-password"
        />
        <PasswordStrengthMeter :password="password" />
      </div>

      <BaseInput
        v-model="confirm"
        id="reset-confirm"
        type="password"
        label="Confirmer le mot de passe"
        placeholder="••••••••"
        :error="errors.confirm"
        required
        autocomplete="new-password"
      />

      <BaseButton type="submit" variant="primary" :loading="loading" full>
        Choisir ce mot de passe
      </BaseButton>
    </form>

    <template #footer>
      <RouterLink :to="{ name: 'login' }">Retour à la connexion</RouterLink>
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
