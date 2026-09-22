<script setup>
/*
 * Bouton de suppression définitive du compte (droit à l'effacement). Le mot de
 * passe est redemandé dans une boîte de confirmation qui explique l'irréversibilité.
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi.js'
import { useAuthStore } from '@/stores/auth.store.js'
import BaseText      from '@/components/atoms/BaseText.vue'
import BaseButton    from '@/components/atoms/BaseButton.vue'
import BaseInput     from '@/components/atoms/BaseInput.vue'
import ConfirmDialog from '@/components/molecules/ConfirmDialog.vue'

const router = useRouter()
const auth   = useAuthStore()
const api    = useApi()

const showDeleteAccount = ref(false)
const deletePassword    = ref('')
const deleteError       = ref('')
const deleteLoading     = ref(false)

function askDeleteAccount() {
  showDeleteAccount.value = true
  deletePassword.value = ''
  deleteError.value = ''
}

async function confirmDeleteAccount() {
  if (!deletePassword.value) {
    deleteError.value = 'Le mot de passe est requis.'
    return
  }

  deleteLoading.value = true
  deleteError.value = ''
  try {
    await api.del('/api/user', { password: deletePassword.value })
    await auth.logout()
    router.push({ name: 'login' })
  } catch (err) {
    deleteError.value = err.message
  } finally {
    deleteLoading.value = false
  }
}
</script>

<template>
  <BaseButton variant="danger" full @click="askDeleteAccount">
    Supprimer mon compte
  </BaseButton>

  <ConfirmDialog
    v-if="showDeleteAccount"
    title="Supprimer définitivement votre compte ?"
    confirm-label="Supprimer définitivement"
    danger
    :loading="deleteLoading"
    @cancel="showDeleteAccount = false"
    @confirm="confirmDeleteAccount"
  >
    <BaseText size="sm" color="secondary">
      Cette action est irréversible : votre compte, vos transactions, vos
      catégories et vos charges fixes seront supprimés définitivement,
      sans aucune trace conservée.
    </BaseText>

    <BaseInput
      v-model="deletePassword"
      id="delete-account-password"
      type="password"
      label="Confirmez avec votre mot de passe"
      :error="deleteError"
      required
    />
  </ConfirmDialog>
</template>
