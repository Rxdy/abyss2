<script setup>
import { ref, watch } from 'vue'
import BaseText  from '@/components/atoms/BaseText.vue'
import BaseChip  from '@/components/atoms/BaseChip.vue'
import AlertBanner    from '@/components/molecules/AlertBanner.vue'
import NotificationRow from '@/components/molecules/NotificationRow.vue'
import { useNotificationsStore } from '@/stores/notifications.store.js'
import { useToastStore } from '@/stores/toast.store.js'

const notifications = useNotificationsStore()
const toasts        = useToastStore()

const tab = ref('active') // 'active' | 'archived'

function load() {
  notifications.fetchAll({ archived: tab.value === 'archived' }).catch(() => {})
}

watch(tab, load, { immediate: true })

async function open(notification) {
  if (!notification.read) await notifications.markRead(notification.id).catch(() => {})
}

async function archive(id) {
  try {
    await notifications.archive(id)
    toasts.success('Notification archivée.')
  } catch (err) {
    notifications.error = err.message
  }
}

async function remove(id) {
  try {
    await notifications.remove(id)
    toasts.success('Notification supprimée.')
  } catch (err) {
    notifications.error = err.message
  }
}
</script>

<template>
  <section class="notifications">
    <header class="notifications__head">
      <BaseText as="h1" size="2xl" weight="bold" color="primary">Notifications</BaseText>
      <BaseText as="p" size="sm" color="muted">
        Dépassements d'enveloppe, dépenses non catégorisées.
      </BaseText>
    </header>

    <div class="notifications__tabs" role="tablist" aria-label="Notifications">
      <BaseChip :active="tab === 'active'" @click="tab = 'active'">Actives</BaseChip>
      <BaseChip :active="tab === 'archived'" @click="tab = 'archived'">Archivées</BaseChip>
    </div>

    <AlertBanner v-if="notifications.error">{{ notifications.error }}</AlertBanner>

    <ul v-if="notifications.items.length" class="notifications__list">
      <NotificationRow
        v-for="notification in notifications.items"
        :key="notification.id"
        :notification="notification"
        @open="open(notification)"
        @archive="archive(notification.id)"
        @remove="remove(notification.id)"
      />
    </ul>

    <BaseText v-else-if="!notifications.loading" as="p" size="sm" color="muted">
      {{ tab === 'active' ? 'Aucune notification pour l\'instant.' : 'Aucune notification archivée.' }}
    </BaseText>
  </section>
</template>

<style scoped>
.notifications {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 32rem;
  margin: 0 auto;
  width: 100%;
}

.notifications__head {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.notifications__tabs {
  display: flex;
  gap: var(--space-2);
}

.notifications__list {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.notifications__list :deep(li + li) { border-top: 1px solid var(--color-border); }
</style>
