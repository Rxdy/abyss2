<script setup>
/*
 * Modale de formulaire : BaseModal + confirmation avant de perdre une saisie.
 * Les formulaires du contenu signalent leur état avec `useDirtyForm` ; on ne
 * demande confirmation que si des champs ont été modifiés.
 */
import { provide, ref } from 'vue'
import BaseModal    from '@/components/molecules/BaseModal.vue'
import ConfirmDialog from '@/components/molecules/ConfirmDialog.vue'
import BaseText     from '@/components/atoms/BaseText.vue'
import { FORM_MODAL_KEY } from '@/composables/useDirtyForm.js'

defineProps({
  title: { type: String, required: true },
})

const emit = defineEmits(['close'])

const dirty      = ref(false)
const confirming = ref(false)

provide(FORM_MODAL_KEY, { setDirty: (value) => { dirty.value = value } })

function requestClose() {
  if (dirty.value) confirming.value = true
  else emit('close')
}
</script>

<template>
  <BaseModal :title="title" :closable="!confirming" @close="requestClose">
    <slot />
  </BaseModal>

  <ConfirmDialog
    v-if="confirming"
    title="Abandonner la saisie ?"
    confirm-label="Abandonner"
    cancel-label="Continuer"
    danger
    @cancel="confirming = false"
    @confirm="emit('close')"
  >
    <BaseText size="sm" color="secondary">
      Ce que vous avez saisi ne sera pas enregistré.
    </BaseText>
  </ConfirmDialog>
</template>
