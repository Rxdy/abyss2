<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi.js'
import { useAuthStore } from '@/stores/auth.store.js'
import BaseText      from '@/components/atoms/BaseText.vue'
import BaseButton    from '@/components/atoms/BaseButton.vue'
import BaseIcon      from '@/components/atoms/BaseIcon.vue'
import AlertBanner from '@/components/molecules/AlertBanner.vue'

const router = useRouter()
const auth   = useAuthStore()
const api    = useApi()

const profile = ref(null)
const error   = ref('')

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' })

function formatDate(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : dateFormat.format(date)
}

async function loadProfile() {
  try {
    profile.value = await api.get('/api/user')
  } catch (err) {
    error.value = err.message
  }
}

async function logout() {
  await auth.logout()
  router.push({ name: 'login' })
}

onMounted(loadProfile)
</script>

<template>
  <section class="profile">
    <BaseText as="h1" size="2xl" weight="bold" color="primary">Profil</BaseText>

    <AlertBanner v-if="error">{{ error }}</AlertBanner>

    <dl class="profile__list">
      <div class="profile__row">
        <dt class="profile__label">
          <BaseIcon name="mail" :size="18" />
          <BaseText size="sm" color="muted">Adresse email</BaseText>
        </dt>
        <dd>
          <BaseText size="base" color="primary">
            {{ profile?.email ?? auth.user?.email ?? '—' }}
          </BaseText>
        </dd>
      </div>

      <div class="profile__row">
        <dt class="profile__label">
          <BaseIcon name="clock" :size="18" />
          <BaseText size="sm" color="muted">Compte créé le</BaseText>
        </dt>
        <dd>
          <BaseText size="base" color="primary">
            {{ profile ? formatDate(profile.createdAt) : '—' }}
          </BaseText>
        </dd>
      </div>

      <div class="profile__row">
        <dt class="profile__label">
          <BaseIcon name="key" :size="18" />
          <BaseText size="sm" color="muted">Identifiant</BaseText>
        </dt>
        <dd>
          <BaseText size="sm" color="secondary" mono truncate>
            {{ profile?.id ?? auth.user?.id ?? '—' }}
          </BaseText>
        </dd>
      </div>
    </dl>

    <!-- Réglages -->
    <nav class="profile__settings" aria-label="Réglages du compte">
      <RouterLink to="/profile/account" class="profile__setting">
        <BaseIcon name="user" :size="18" />
        <div class="profile__setting-body">
          <BaseText size="sm" weight="medium" color="primary">Gestion du compte</BaseText>
          <BaseText size="xs" color="muted">Adresse email, mot de passe</BaseText>
        </div>
        <BaseIcon name="chevron" :size="18" />
      </RouterLink>

      <RouterLink to="/profile/preferences" class="profile__setting">
        <BaseIcon name="sun" :size="18" />
        <div class="profile__setting-body">
          <BaseText size="sm" weight="medium" color="primary">Préférences</BaseText>
          <BaseText size="xs" color="muted">Thème, devise, session, notifications</BaseText>
        </div>
        <BaseIcon name="chevron" :size="18" />
      </RouterLink>

      <RouterLink to="/profile/categories" class="profile__setting">
        <BaseIcon name="tag" :size="18" />
        <div class="profile__setting-body">
          <BaseText size="sm" weight="medium" color="primary">Catégories</BaseText>
          <BaseText size="xs" color="muted">Créer, renommer, supprimer</BaseText>
        </div>
        <BaseIcon name="chevron" :size="18" />
      </RouterLink>

      <RouterLink to="/profile/envelopes" class="profile__setting">
        <BaseIcon name="mail" :size="18" />
        <div class="profile__setting-body">
          <BaseText size="sm" weight="medium" color="primary">Enveloppes</BaseText>
          <BaseText size="xs" color="muted">Plafonds mensuels par groupe de catégories</BaseText>
        </div>
        <BaseIcon name="chevron" :size="18" />
      </RouterLink>

      <RouterLink to="/profile/data" class="profile__setting">
        <BaseIcon name="download" :size="18" />
        <div class="profile__setting-body">
          <BaseText size="sm" weight="medium" color="primary">Mes données</BaseText>
          <BaseText size="xs" color="muted">Exporter, réinitialiser, supprimer le compte</BaseText>
        </div>
        <BaseIcon name="chevron" :size="18" />
      </RouterLink>

      <RouterLink to="/profile/support" class="profile__setting">
        <BaseIcon name="message" :size="18" />
        <div class="profile__setting-body">
          <BaseText size="sm" weight="medium" color="primary">Support</BaseText>
          <BaseText size="xs" color="muted">Signaler un bug, proposer une amélioration</BaseText>
        </div>
        <BaseIcon name="chevron" :size="18" />
      </RouterLink>
    </nav>

    <div class="profile__actions">
      <BaseButton class="profile__logout" variant="danger" full @click="logout">
        <BaseIcon name="logout" :size="18" />
        Se déconnecter
      </BaseButton>
      <BaseText size="xs" color="muted">
        {{ auth.user?.sessionMode === 'strict'
          ? 'Déconnexion automatique à la fermeture du navigateur ou après 30 minutes d\'inactivité.'
          : 'Vous restez connecté sur cet appareil — modifiable dans les Préférences.' }}
      </BaseText>
    </div>

  </section>
</template>

<style scoped>
.profile {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 32rem;
  margin: 0 auto;
  width: 100%;
}


.profile__list {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.profile__row {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4);
}

.profile__row + .profile__row {
  border-top: 1px solid var(--color-border);
}

.profile__label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--color-text-muted);
}


.profile__settings {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.profile__setting {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-4);
  color: var(--color-text-muted);
  transition: background var(--transition-fast);
}

.profile__setting:hover { background: var(--color-primary-subtle); }

.profile__setting-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.profile__actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

</style>
