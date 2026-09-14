<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi.js'
import { useAuthStore } from '@/stores/auth.store.js'
import BaseText      from '@/components/atoms/BaseText.vue'
import BaseButton    from '@/components/atoms/BaseButton.vue'
import BaseIcon      from '@/components/atoms/BaseIcon.vue'
import BaseInput     from '@/components/atoms/BaseInput.vue'
import ConfirmDialog from '@/components/molecules/ConfirmDialog.vue'

const router = useRouter()
const auth   = useAuthStore()
const api    = useApi()

const profile = ref(null)
const error   = ref('')

// ── Suppression définitive du compte (droit à l'effacement) ──────────────
const showDeleteAccount = ref(false)
const deletePassword    = ref('')
const deleteError       = ref('')
const deleteLoading     = ref(false)

function askDeleteAccount() {
  showDeleteAccount.value = true
  deletePassword.value = ''
  deleteError.value = ''
}

async function confirmDeleteAccount() {
  if (!deletePassword.value) {
    deleteError.value = 'Le mot de passe est requis.'
    return
  }

  deleteLoading.value = true
  deleteError.value = ''
  try {
    await api.del('/api/user', { password: deletePassword.value })
    auth.logout()
    router.push({ name: 'login' })
  } catch (err) {
    deleteError.value = err.message
  } finally {
    deleteLoading.value = false
  }
}

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

function logout() {
  auth.logout()
  router.push({ name: 'login' })
}

onMounted(loadProfile)
</script>

<template>
  <section class="profile">
    <BaseText as="h1" size="2xl" weight="bold" color="primary">Profil</BaseText>

    <div v-if="error" class="profile__error" role="alert">
      <BaseText size="sm" color="danger">{{ error }}</BaseText>
    </div>

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
      <RouterLink to="/profile/categories" class="profile__setting">
        <BaseIcon name="tag" :size="18" />
        <div class="profile__setting-body">
          <BaseText size="sm" weight="medium" color="primary">Catégories</BaseText>
          <BaseText size="xs" color="muted">Créer, renommer, supprimer</BaseText>
        </div>
        <BaseIcon name="chevron" :size="18" />
      </RouterLink>

      <RouterLink to="/profile/recurring" class="profile__setting">
        <BaseIcon name="clock" :size="18" />
        <div class="profile__setting-body">
          <BaseText size="sm" weight="medium" color="primary">Dépenses &amp; revenus fixes</BaseText>
          <BaseText size="xs" color="muted">Loyer, salaire, abonnements…</BaseText>
        </div>
        <BaseIcon name="chevron" :size="18" />
      </RouterLink>
    </nav>

    <div class="profile__actions">
      <BaseButton variant="danger" full @click="logout">
        <BaseIcon name="logout" :size="18" />
        Se déconnecter
      </BaseButton>
      <BaseText size="xs" color="muted">
        La session n'est gardée que dans cet onglet.
      </BaseText>
    </div>

    <!-- Zone de danger -->
    <div class="profile__danger">
      <BaseText as="h2" size="sm" weight="semibold" color="danger">Zone de danger</BaseText>
      <BaseText size="xs" color="muted">
        Supprime définitivement le compte ainsi que toutes les données
        associées (transactions, catégories, charges fixes). Aucune trace
        n'est conservée, l'opération est irréversible.
      </BaseText>
      <BaseButton variant="danger" full @click="askDeleteAccount">
        Supprimer mon compte
      </BaseButton>
    </div>

    <ConfirmDialog
      v-if="showDeleteAccount"
      title="Supprimer définitivement votre compte ?"
      confirm-label="Supprimer définitivement"
      danger
      :loading="deleteLoading"
      @cancel="showDeleteAccount = false"
      @confirm="confirmDeleteAccount"
    >
      <BaseText size="sm" color="secondary">
        Cette action est irréversible : votre compte, vos transactions, vos
        catégories et vos charges fixes seront supprimés définitivement,
        sans aucune trace conservée.
      </BaseText>

      <BaseInput
        v-model="deletePassword"
        id="delete-account-password"
        type="password"
        label="Confirmez avec votre mot de passe"
        :error="deleteError"
        required
      />
    </ConfirmDialog>
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

.profile__error {
  background: var(--color-danger-subtle);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
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

.profile__danger {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  border: 1px solid var(--color-danger);
  background: var(--color-danger-subtle);
  border-radius: var(--radius-lg);
}
</style>
