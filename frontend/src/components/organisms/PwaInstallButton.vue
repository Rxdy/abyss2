<script setup>
import { ref } from 'vue'
import { usePwaInstall } from '@/composables/usePwaInstall.js'
import BaseIcon      from '@/components/atoms/BaseIcon.vue'
import IconButton    from '@/components/atoms/IconButton.vue'
import ConfirmDialog from '@/components/molecules/ConfirmDialog.vue'

const { available, canPrompt, install } = usePwaInstall()

const showHelp = ref(false)

/** Navigateurs avec invite native → on l'ouvre ; iOS → on explique la marche à suivre. */
function onClick() {
  if (canPrompt.value) install()
  else showHelp.value = true
}
</script>

<template>
  <IconButton
    v-if="available"
    class="pwa-install"
    variant="accent"
    label="Installer l'application"
    @click="onClick"
  >
    <BaseIcon name="download" :size="18" />
    <span class="pwa-install__label">Installer</span>
  </IconButton>

  <ConfirmDialog
    v-if="showHelp"
    title="Installer Abyss2"
    confirm-label="J'ai compris"
    hide-cancel
    @confirm="showHelp = false"
    @cancel="showHelp = false"
  >
    <p class="pwa-install__help">
      Dans Safari, touchez le bouton <strong>Partager</strong>, puis
      <strong>Sur l'écran d'accueil</strong>. Abyss2 s'ouvrira ensuite comme
      une application, sans barre d'adresse.
    </p>
  </ConfirmDialog>
</template>

<style scoped>

/* Icône seule sur mobile (le libellé reste lu par les lecteurs d'écran via aria-label) */
.pwa-install__label { display: none; }

@media (min-width: 640px) {
  .pwa-install { padding: 0 var(--space-3); }
  .pwa-install__label { display: inline; }
}

.pwa-install__help {
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  line-height: var(--leading-normal);
}
</style>
