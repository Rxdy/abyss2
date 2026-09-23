<script setup>
/*
 * Réinitialise les données du compte (catégories, transactions, charges
 * fixes, enveloppes) — le compte et le mot de passe sont conservés. Contrairement
 * à la suppression du compte (DangerZone.vue), le mot de passe n'est pas redemandé :
 * on fait saisir le mot CONFIRM_WORD à la place, qui sert uniquement de garde-fou
 * contre un clic accidentel (aucune vérification côté API).
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi.js'
import BaseText      from '@/components/atoms/BaseText.vue'
import BaseButton    from '@/components/atoms/BaseButton.vue'
import BaseInput     from '@/components/atoms/BaseInput.vue'
import ConfirmDialog from '@/components/molecules/ConfirmDialog.vue'

const CONFIRM_WORD = 'RÉINITIALISER'

const router = useRouter()
const api    = useApi()

const showReset  = ref(false)
const confirmText = ref('')
const error      = ref('')
const loading    = ref(false)

function askReset() {
  showReset.value  = true
  confirmText.value = ''
  error.value      = ''
}

async function confirmReset() {
  if (confirmText.value.trim().toUpperCase() !== CONFIRM_WORD) {
    error.value = `Tapez « ${CONFIRM_WORD} » pour confirmer.`
    return
  }

  loading.value = true
  error.value = ''
  try {
    await api.del('/api/user/data')
    showReset.value = false
    // Toutes les données affichées (transactions, catégories…) sont obsolètes : on
    // recharge plutôt que de tenter de rafraîchir chaque store un par un.
    router.push('/').then(() => window.location.reload())
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <BaseButton variant="danger" full @click="askReset">
    Réinitialiser mes données
  </BaseButton>

  <ConfirmDialog
    v-if="showReset"
    title="Réinitialiser toutes vos données ?"
    confirm-label="Réinitialiser"
    danger
    :loading="loading"
    @cancel="showReset = false"
    @confirm="confirmReset"
  >
    <BaseText size="sm" color="secondary">
      Cette action est irréversible : vos transactions, catégories, charges
      fixes et enveloppes seront supprimées définitivement. Les catégories
      par défaut sont recréées, comme à l'inscription. Votre compte et votre
      mot de passe restent inchangés.
    </BaseText>

    <BaseInput
      v-model="confirmText"
      id="reset-data-confirm"
      :label="`Tapez « ${CONFIRM_WORD} » pour confirmer`"
      :error="error"
      autocomplete="off"
      required
    />
  </ConfirmDialog>
</template>
