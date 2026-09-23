<script setup>
/*
 * Changement de mot de passe, prévu pour vivre dans une modale (FormModal).
 * Le serveur invalide les autres sessions et renvoie un nouveau jeton, qui
 * garde cet appareil connecté. `saved` / `cancel` préviennent le parent.
 */
import { ref } from 'vue'
import { useApi } from '@/composables/useApi.js'
import { useDirtyForm } from '@/composables/useDirtyForm.js'
import { useAuthStore } from '@/stores/auth.store.js'
import { useToastStore } from '@/stores/toast.store.js'
import BaseButton  from '@/components/atoms/BaseButton.vue'
import BaseInput   from '@/components/atoms/BaseInput.vue'
import AlertBanner from '@/components/molecules/AlertBanner.vue'

const emit = defineEmits(['saved', 'cancel'])

const auth   = useAuthStore()
const toasts = useToastStore()
const api    = useApi()

const noErrors = () => ({ current: '', next: '', confirm: '', global: '' })

const form    = ref({ current: '', next: '', confirm: '' })
const errors  = ref(noErrors())
const loading = ref(false)

useDirtyForm(form)

async function submit() {
  errors.value = noErrors()
  let ok = true

  if (!form.value.current) {
    errors.value.current = 'Requis.'
    ok = false
  }
  if (form.value.next.length < 8) {
    errors.value.next = '8 caractères minimum.'
    ok = false
  }
  if (form.value.confirm !== form.value.next) {
    errors.value.confirm = 'Ne correspond pas au nouveau mot de passe.'
    ok = false
  }
  if (!ok) return

  loading.value = true
  try {
    const { csrfToken } = await api.put('/api/user/password', {
      currentPassword: form.value.current,
      newPassword: form.value.next,
    })
    auth.setCsrfToken(csrfToken)
    toasts.success('Mot de passe modifié. Vos autres appareils ont été déconnectés.', { duration: 6000 })
    emit('saved')
  } catch (err) {
    errors.value.global = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="password-change" novalidate @submit.prevent="submit">
    <AlertBanner v-if="errors.global">{{ errors.global }}</AlertBanner>

    <BaseInput
      v-model="form.current"
      id="password-current"
      type="password"
      label="Mot de passe actuel"
      :error="errors.current"
      required
    />
    <BaseInput
      v-model="form.next"
      id="password-next"
      type="password"
      label="Nouveau mot de passe"
      hint="8 caractères minimum."
      :error="errors.next"
      required
    />
    <BaseInput
      v-model="form.confirm"
      id="password-confirm"
      type="password"
      label="Confirmer le nouveau mot de passe"
      :error="errors.confirm"
      required
    />

    <div class="password-change__actions">
      <BaseButton type="submit" variant="primary" :loading="loading" full>
        Changer le mot de passe
      </BaseButton>
      <BaseButton type="button" variant="ghost" full @click="emit('cancel')">
        Annuler
      </BaseButton>
    </div>
  </form>
</template>

<style scoped>
.password-change {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.password-change__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
