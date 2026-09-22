<script setup>
/*
 * Invitation à passer à la nouvelle version de l'app (voir usePwaUpdate). Discrète :
 * l'utilisateur choisit quand recharger, pour ne pas perdre une saisie en cours.
 */
import { usePwaUpdate } from '@/composables/usePwaUpdate.js'
import BaseButton from '@/components/atoms/BaseButton.vue'
import BaseText   from '@/components/atoms/BaseText.vue'

const { visible, update, dismiss } = usePwaUpdate()
</script>

<template>
  <!-- role="status" : annoncé poliment, sans interrompre comme le ferait une alerte -->
  <div v-if="visible" class="update-banner" role="status">
    <BaseText size="sm" weight="medium" color="primary" class="update-banner__text">
      Une nouvelle version d'Abyss2 est disponible.
    </BaseText>
    <div class="update-banner__actions">
      <BaseButton variant="primary" size="sm" @click="update">Mettre à jour</BaseButton>
      <BaseButton variant="ghost" size="sm" @click="dismiss">Plus tard</BaseButton>
    </div>
  </div>
</template>

<style scoped>
.update-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2) var(--space-4);
  margin: var(--space-3) var(--content-padding) 0;
  padding: var(--space-3) var(--space-4);
  background: var(--color-primary-subtle);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
}

.update-banner__text { flex: 1; min-width: 12rem; }

.update-banner__actions {
  display: flex;
  gap: var(--space-2);
}
</style>
