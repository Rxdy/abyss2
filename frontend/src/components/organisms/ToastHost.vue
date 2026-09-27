<script setup>
import { useToastStore } from '@/stores/toast.store.js'
import BaseIcon   from '@/components/atoms/BaseIcon.vue'
import BaseText   from '@/components/atoms/BaseText.vue'
import IconButton from '@/components/atoms/IconButton.vue'

const toasts = useToastStore()
</script>

<template>
  <!-- Zone live : les lecteurs d'écran annoncent chaque notification sans déplacer le focus. -->
  <div class="toasts" role="status" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="toast in toasts.items" :key="toast.id" class="toast" :class="`toast--${toast.tone}`">
        <BaseText size="sm" weight="medium" color="primary" class="toast__message">{{ toast.message }}</BaseText>
        <IconButton label="Fermer la notification" @click="toasts.dismiss(toast.id)">
          <BaseIcon name="close" :size="16" />
        </IconButton>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  z-index: var(--z-toast);
  left: var(--space-4);
  right: var(--space-4);
  /* Au-dessus de la barre de navigation basse (mobile / tablette). */
  bottom: calc(var(--navbar-height) + var(--space-4));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  max-width: 28rem;
  width: 100%;
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-left: 4px solid var(--color-success);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg, 0 8px 24px rgb(0 0 0 / 0.25));
}

.toast--danger { border-left-color: var(--color-danger); }

.toast__message { flex: 1; min-width: 0; }

.toast-enter-active,
.toast-leave-active { transition: opacity var(--transition-fast), transform var(--transition-fast); }
.toast-enter-from,
.toast-leave-to { opacity: 0; transform: translateY(8px); }

@media (min-width: 1024px) {
  .toasts { bottom: var(--space-6); }
}
</style>
