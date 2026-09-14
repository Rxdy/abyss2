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

// ── Changement de mot de passe ────────────────────────────────────────────
const passwordForm    = ref({ current: '', next: '', confirm: '' })
const passwordErrors  = ref({ current: '', next: '', confirm: '', global: '' })
const passwordLoading = ref(false)
const passwordSuccess = ref('')

function resetPasswordForm() {
  passwordForm.value = { current: '', next: '', confirm: '' }
  passwordErrors.value = { current: '', next: '', confirm: '', global: '' }
}

async function submitPasswordChange() {
  passwordErrors.value = { current: '', next: '', confirm: '', global: '' }
  passwordSuccess.value = ''
  let ok = true

  if (!passwordForm.value.current) {
    passwordErrors.value.current = 'Requis.'
    ok = false
  }
  if (passwordForm.value.next.length < 8) {
    passwordErrors.value.next = '8 caractères minimum.'
    ok = false
  }
  if (passwordForm.value.confirm !== passwordForm.value.next) {
    passwordErrors.value.confirm = 'Ne correspond pas au nouveau mot de passe.'
    ok = false
  }
  if (!ok) return

  passwordLoading.value = true
  try {
    const { token } = await api.put('/api/user/password', {
      currentPassword: passwordForm.value.current,
      newPassword: passwordForm.value.next,
    })
    auth.setToken(token)
    passwordSuccess.value = 'Mot de passe modifié. Vos autres appareils ont été déconnectés.'
    resetPasswordForm()
  } catch (err) {
    passwordErrors.value.global = err.message
  } finally {
    passwordLoading.value = false
  }
}

// ── Déconnexion des autres appareils ──────────────────────────────────────
const devicesLoading = ref(false)
const devicesMessage = ref('')
const devicesError   = ref('')

async function revokeOtherDevices() {
  devicesLoading.value = true
  devicesMessage.value = ''
  devicesError.value = ''
  try {
    const { token } = await api.post('/api/user/revoke-sessions')
    auth.setToken(token)
    devicesMessage.value = 'Tous les autres appareils ont été déconnectés.'
  } catch (err) {
    devicesError.value = err.message
  } finally {
    devicesLoading.value = false
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

    <!-- Sécurité : mot de passe -->
    <section class="profile__section">
      <BaseText as="h2" size="sm" weight="semibold" color="primary">Mot de passe</BaseText>

      <div v-if="passwordErrors.global" class="profile__error" role="alert">
        <BaseText size="sm" color="danger">{{ passwordErrors.global }}</BaseText>
      </div>
      <div v-if="passwordSuccess" class="profile__success" role="status">
        <BaseText size="sm" color="success">{{ passwordSuccess }}</BaseText>
      </div>

      <form class="profile__form" novalidate @submit.prevent="submitPasswordChange">
        <BaseInput
          v-model="passwordForm.current"
          id="password-current"
          type="password"
          label="Mot de passe actuel"
          :error="passwordErrors.current"
          required
        />
        <BaseInput
          v-model="passwordForm.next"
          id="password-next"
          type="password"
          label="Nouveau mot de passe"
          hint="8 caractères minimum."
          :error="passwordErrors.next"
          required
        />
        <BaseInput
          v-model="passwordForm.confirm"
          id="password-confirm"
          type="password"
          label="Confirmer le nouveau mot de passe"
          :error="passwordErrors.confirm"
          required
        />
        <BaseButton type="submit" variant="secondary" :loading="passwordLoading" full>
          Changer le mot de passe
        </BaseButton>
      </form>
    </section>

    <!-- Sécurité : appareils -->
    <section class="profile__section">
      <BaseText as="h2" size="sm" weight="semibold" color="primary">Appareils connectés</BaseText>
      <BaseText size="xs" color="muted">
        Changer le mot de passe déconnecte déjà automatiquement les autres
        appareils. Utile aussi si une session est restée ouverte ailleurs.
      </BaseText>

      <div v-if="devicesError" class="profile__error" role="alert">
        <BaseText size="sm" color="danger">{{ devicesError }}</BaseText>
      </div>
      <div v-if="devicesMessage" class="profile__success" role="status">
        <BaseText size="sm" color="success">{{ devicesMessage }}</BaseText>
      </div>

      <BaseButton variant="secondary" :loading="devicesLoading" full @click="revokeOtherDevices">
        <BaseIcon name="devices" :size="18" />
        Déconnecter tous les autres appareils
      </BaseButton>
    </section>

    <div class="profile__actions">
      <BaseButton class="profile__logout" variant="danger" full @click="logout">
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

.profile__success {
  background: var(--color-success-subtle);
  border: 1px solid var(--color-success);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}

.profile__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.profile__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
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
