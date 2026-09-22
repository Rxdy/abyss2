<script setup>
import { ref } from 'vue'
import { useApi } from '@/composables/useApi.js'
import BaseInput   from '@/components/atoms/BaseInput.vue'
import BaseButton  from '@/components/atoms/BaseButton.vue'
import BaseText    from '@/components/atoms/BaseText.vue'
import AlertBanner from '@/components/molecules/AlertBanner.vue'
import AuthShell   from '@/components/organisms/AuthShell.vue'

const email   = ref('')
const loading = ref(false)
const sent    = ref(false)
const errors  = ref({ email: '', global: '' })

function validate() {
  errors.value = { email: '', global: '' }
  if (!email.value.trim()) {
    errors.value.email = 'L\'adresse email est requise.'
    return false
  }
  return true
}

async function submit() {
  if (!validate()) return
  loading.value = true

  try {
    const api = useApi()
    // L'API répond toujours de la même façon, que le compte existe ou non (voir ARCHITECTURE.md) :
    // rien ici ne distingue les deux cas, volontairement.
    await api.post('/api/auth/forgot-password', { email: email.value.toLowerCase().trim() })
    sent.value = true
  } catch (err) {
    errors.value.global = err.message || 'Impossible d\'envoyer l\'email pour le moment. Réessayez.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell subtitle="Mot de passe oublié">
    <template v-if="sent">
      <BaseText size="sm" color="secondary">
        Si un compte existe pour cette adresse, un email vient d'être envoyé avec un lien pour
        choisir un nouveau mot de passe. Le lien reste valable une heure.
      </BaseText>
    </template>

    <form v-else class="auth-form" novalidate @submit.prevent="submit">
      <Transition name="fade">
        <AlertBanner v-if="errors.global">{{ errors.global }}</AlertBanner>
      </Transition>

      <BaseText size="sm" color="secondary">
        Indiquez votre adresse email : si un compte y est associé, vous recevrez un lien pour
        choisir un nouveau mot de passe.
      </BaseText>

      <BaseInput
        v-model="email"
        id="forgot-email"
        type="email"
        label="Adresse email"
        placeholder="vous@exemple.com"
        :error="errors.email"
        required
        autocomplete="email"
      />

      <BaseButton type="submit" variant="primary" :loading="loading" full>
        Envoyer le lien
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

.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to       { opacity: 0; }
</style>
