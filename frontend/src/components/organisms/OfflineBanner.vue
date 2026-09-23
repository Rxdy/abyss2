<script setup>
import { useOnlineStatus } from '@/composables/useOnlineStatus.js'
import AlertBanner from '@/components/molecules/AlertBanner.vue'

const { online } = useOnlineStatus()
</script>

<template>
  <AlertBanner v-if="!online" variant="warning" class="offline-banner">
    Vous êtes hors ligne — l'interface reste disponible, mais vos données ne se chargeront
    qu'une fois la connexion rétablie.
  </AlertBanner>
</template>

<style scoped>
.offline-banner {
  margin: var(--space-3) var(--content-padding) 0;
}
</style>
