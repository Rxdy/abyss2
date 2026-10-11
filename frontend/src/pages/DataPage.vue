<script setup>
/*
 * Mes données : exporter (portabilité), réinitialiser les données, supprimer le compte. Regroupés
 * ici plutôt que sur le Profil, où ces gros boutons — dont deux irréversibles — faisaient peur.
 */
import { ref } from 'vue'
import { useApi } from '@/composables/useApi.js'
import BaseText        from '@/components/atoms/BaseText.vue'
import BaseButton      from '@/components/atoms/BaseButton.vue'
import BaseIcon        from '@/components/atoms/BaseIcon.vue'
import AlertBanner     from '@/components/molecules/AlertBanner.vue'
import DangerZone      from '@/components/organisms/DangerZone.vue'
import ResetDataButton from '@/components/organisms/ResetDataButton.vue'
import { todayISO } from '@/utils/format.js'

const api = useApi()

const EXPORTS = [
  { format: 'json', label: 'Tout exporter (JSON)' },
  { format: 'csv',  label: 'Transactions (CSV)' },
]
const exporting   = ref('')
const exportError = ref('')

async function exportData(format) {
  exporting.value = format
  exportError.value = ''
  try {
    await api.download(`/api/user/export?format=${format}`, `abyss-${todayISO()}.${format}`)
  } catch (err) {
    exportError.value = err.message
  } finally {
    exporting.value = ''
  }
}
</script>

<template>
  <section class="data">
    <header class="data__head">
      <RouterLink to="/profile" class="data__back">
        <BaseText size="sm" color="muted">← Profil</BaseText>
      </RouterLink>
      <BaseText as="h1" size="2xl" weight="bold" color="primary">Mes données</BaseText>
      <BaseText as="p" size="sm" color="muted">
        Récupérer une copie de vos données, ou repartir de zéro.
      </BaseText>
    </header>

    <section class="data__section">
      <BaseText as="h2" size="sm" weight="semibold" color="primary">Exporter</BaseText>
      <BaseText as="p" size="xs" color="muted">
        Le JSON contient tout votre compte ; le CSV, vos transactions, à ouvrir dans un tableur.
      </BaseText>

      <AlertBanner v-if="exportError">{{ exportError }}</AlertBanner>

      <BaseButton
        v-for="option in EXPORTS"
        :key="option.format"
        variant="secondary"
        full
        :loading="exporting === option.format"
        :disabled="exporting !== ''"
        @click="exportData(option.format)"
      >
        <BaseIcon name="download" :size="18" />
        {{ option.label }}
      </BaseButton>
    </section>

    <section class="data__section">
      <BaseText as="h2" size="sm" weight="semibold" color="primary">Réinitialiser</BaseText>
      <BaseText as="p" size="xs" color="muted">
        Efface transactions, catégories, charges fixes et enveloppes. Votre compte reste ouvert.
      </BaseText>
      <ResetDataButton />
    </section>

    <section class="data__section">
      <BaseText as="h2" size="sm" weight="semibold" color="primary">Supprimer le compte</BaseText>
      <BaseText as="p" size="xs" color="muted">
        Supprime le compte et toutes ses données, sans retour possible.
      </BaseText>
      <DangerZone />
    </section>
  </section>
</template>

<style scoped>
.data {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 32rem;
  margin: 0 auto;
  width: 100%;
}

.data__head {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.data__back { align-self: flex-start; }

.data__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}
</style>
