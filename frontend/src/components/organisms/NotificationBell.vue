<script setup>
/*
 * Cloche du header : mène à /notifications, badge du nombre de non lues.
 * Le compte est rafraîchi au montage (donc à chaque chargement de l'app) —
 * pas de sondage périodique, cohérent avec l'absence de tâche planifiée
 * côté API (voir utils/notifications.ts).
 */
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import BaseIcon   from '@/components/atoms/BaseIcon.vue'
import BaseText   from '@/components/atoms/BaseText.vue'
import IconButton from '@/components/atoms/IconButton.vue'
import { useAuthStore } from '@/stores/auth.store.js'
import { useNotificationsStore } from '@/stores/notifications.store.js'

const router = useRouter()
const auth   = useAuthStore()
const notifications = useNotificationsStore()

// AppHeader (donc cette cloche) peut se monter brièvement pendant la résolution initiale du
// routeur, avant la redirection vers /login — un appel authentifié à ce moment-là échoue toujours
// (401 attendu, mais bruyant en console) : voir App.vue::validateSession, qui se garde pareil.
onMounted(() => { if (auth.isAuthenticated) notifications.fetchUnreadCount() })
</script>

<template>
  <div class="notification-bell">
    <IconButton variant="outline" label="Notifications" @click="router.push('/notifications')">
      <BaseIcon name="bell" :size="18" />
    </IconButton>

    <BaseText
      v-if="notifications.unreadCount > 0"
      as="span"
      size="xs"
      weight="semibold"
      class="notification-bell__badge"
    >
      {{ notifications.unreadCount > 9 ? '9+' : notifications.unreadCount }}
    </BaseText>
  </div>
</template>

<style scoped>
.notification-bell {
  position: relative;
  display: inline-flex;
}

.notification-bell__badge {
  position: absolute;
  top: -0.25rem;
  right: -0.25rem;
  min-width: 1.125rem;
  height: 1.125rem;
  padding: 0 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  background: var(--color-danger);
  color: var(--color-text-inverse);
  line-height: 1;
}
</style>
