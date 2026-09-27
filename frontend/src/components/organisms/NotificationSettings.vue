<script setup>
/*
 * Réglages des notifications (page Profil) : un interrupteur par type. Couper un type arrête sa
 * génération côté API ; les notifications déjà reçues restent dans la liste.
 */
import { onMounted, ref } from 'vue'
import BaseSwitch  from '@/components/atoms/BaseSwitch.vue'
import BaseText    from '@/components/atoms/BaseText.vue'
import AlertBanner from '@/components/molecules/AlertBanner.vue'
import { useNotificationsStore } from '@/stores/notifications.store.js'

const notifications = useNotificationsStore()
const error = ref('')

const TYPES = [
  { key: 'envelopeOverspend',   label: 'Enveloppe dépassée',        hint: 'Quand une dépense fait passer une enveloppe au-dessus de son plafond du mois' },
  { key: 'negativeBalance',     label: 'Solde négatif',             hint: 'Quand votre solde passe sous zéro' },
  { key: 'uncategorizedDigest', label: 'Dépenses non catégorisées', hint: 'Rappel au plus une fois par semaine' },
]

onMounted(async () => {
  try {
    await notifications.fetchSettings()
  } catch (err) {
    error.value = err.message
  }
})

async function toggle(key, enabled) {
  error.value = ''
  try {
    await notifications.updateSetting(key, enabled)
  } catch (err) {
    error.value = err.message
  }
}
</script>

<template>
  <section class="notification-settings" aria-labelledby="notification-settings-title">
    <BaseText id="notification-settings-title" as="h2" size="sm" weight="semibold" color="primary">Notifications</BaseText>

    <AlertBanner v-if="error">{{ error }}</AlertBanner>

    <ul class="notification-settings__list">
      <li v-for="type in TYPES" :key="type.key" class="notification-settings__row">
        <label :for="`notify-${type.key}`" class="notification-settings__text">
          <BaseText size="sm" weight="medium" color="primary">{{ type.label }}</BaseText>
          <BaseText size="xs" color="muted">{{ type.hint }}</BaseText>
        </label>
        <BaseSwitch
          :id="`notify-${type.key}`"
          :model-value="notifications.settings?.[type.key] ?? false"
          :disabled="!notifications.settings"
          @update:model-value="toggle(type.key, $event)"
        />
      </li>
    </ul>
  </section>
</template>

<style scoped>
.notification-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.notification-settings__list {
  display: flex;
  flex-direction: column;
}

.notification-settings__row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) 0;
}

.notification-settings__row + .notification-settings__row { border-top: 1px solid var(--color-border); }

.notification-settings__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
}
</style>
