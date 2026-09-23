<script setup>
/*
 * Ligne de la liste des notifications : icône selon le type, titre, message,
 * date relative, pastille si non lue, actions archiver/supprimer.
 */
import BaseIcon   from '@/components/atoms/BaseIcon.vue'
import BaseText   from '@/components/atoms/BaseText.vue'
import IconButton from '@/components/atoms/IconButton.vue'

const props = defineProps({
  notification: { type: Object, required: true }, // { id, type, title, message, read, createdAt }
})

defineEmits(['open', 'archive', 'remove'])

const ICONS = { envelope_overspend: 'bell', uncategorized_digest: 'tag' }
const icon = ICONS[props.notification.type] ?? 'bell'

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' })
function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date)
}
</script>

<template>
  <li class="notification" :class="{ 'notification--unread': !notification.read }">
    <component :is="'button'" type="button" class="notification__main" @click="$emit('open')">
      <span class="notification__icon" aria-hidden="true"><BaseIcon :name="icon" :size="18" /></span>

      <span class="notification__body">
        <span class="notification__title-row">
          <BaseText size="sm" weight="semibold" color="primary">{{ notification.title }}</BaseText>
          <span v-if="!notification.read" class="notification__dot" aria-label="Non lue" />
        </span>
        <BaseText size="sm" color="secondary">{{ notification.message }}</BaseText>
        <BaseText size="xs" color="muted">{{ formatDate(notification.createdAt) }}</BaseText>
      </span>
    </component>

    <div class="notification__actions">
      <IconButton label="Archiver" @click="$emit('archive')">
        <BaseIcon name="archive" :size="16" />
      </IconButton>
      <IconButton danger label="Supprimer" @click="$emit('remove')">
        <BaseIcon name="trash" :size="16" />
      </IconButton>
    </div>
  </li>
</template>

<style scoped>
.notification {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
}

.notification--unread { background: var(--color-primary-subtle); }

.notification__main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  text-align: left;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

.notification__icon {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-elevated);
  color: var(--color-text-secondary);
}

.notification__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.notification__title-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.notification__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: var(--radius-full);
  background: var(--color-primary);
  flex-shrink: 0;
}

.notification__actions {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
</style>
