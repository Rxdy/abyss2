<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import BaseText   from '@/components/atoms/BaseText.vue'
import BaseButton from '@/components/atoms/BaseButton.vue'

defineProps({
  title:         { type: String, required: true },
  confirmLabel:  { type: String, default: 'Confirmer' },
  cancelLabel:   { type: String, default: 'Annuler' },
  danger:        { type: Boolean, default: false },
  hideCancel:    { type: Boolean, default: false },
  loading:       { type: Boolean, default: false },
})

const emit = defineEmits(['confirm', 'cancel'])

function onKeydown(event) {
  if (event.key === 'Escape') emit('cancel')
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div class="dialog-overlay" role="presentation" @mousedown.self="emit('cancel')">
      <div class="dialog" role="alertdialog" aria-modal="true" :aria-label="title">
        <BaseText as="h2" size="lg" weight="semibold" color="primary">{{ title }}</BaseText>

        <div class="dialog__body">
          <slot />
        </div>

        <div class="dialog__actions">
          <BaseButton v-if="!hideCancel" type="button" variant="ghost" :disabled="loading" @click="emit('cancel')">
            {{ cancelLabel }}
          </BaseButton>
          <BaseButton
            type="button"
            :variant="danger ? 'danger' : 'primary'"
            :loading="loading"
            @click="emit('confirm')"
          >
            {{ confirmLabel }}
          </BaseButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  z-index: 100;
}

.dialog {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  max-width: 26rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--space-5);
}

.dialog__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
</style>
