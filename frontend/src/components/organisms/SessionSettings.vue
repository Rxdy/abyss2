<script setup>
/*
 * Mode de session (Préférences) : rester connecté, ou se reconnecter à chaque session. Enregistré
 * sur le compte ; c'est l'API qui pose le cookie en conséquence (voir backend utils/session.ts) et
 * ré-émet tout de suite la session de cet appareil selon le nouveau mode.
 */
import { computed, ref } from 'vue'
import { useApi } from '@/composables/useApi.js'
import { useAuthStore } from '@/stores/auth.store.js'
import { useToastStore } from '@/stores/toast.store.js'
import BaseRadio   from '@/components/atoms/BaseRadio.vue'
import BaseText    from '@/components/atoms/BaseText.vue'
import AlertBanner from '@/components/molecules/AlertBanner.vue'

const auth   = useAuthStore()
const toasts = useToastStore()
const api    = useApi()

const saving = ref(false)
const error  = ref('')

const MODES = [
  {
    value: 'persistent',
    label: 'Rester connecté',
    hint:  'Vous restez connecté sur cet appareil tant que vous ouvrez l\'app au moins une fois par mois.',
  },
  {
    value: 'strict',
    label: 'Connexion à chaque session',
    hint:  'Déconnexion à la fermeture du navigateur ou après 30 minutes d\'inactivité. Plus sûr sur un appareil partagé.',
  },
]

// Choix affiché tout de suite, avant la réponse de l'API. Le remettre à null en cas d'échec fait
// décocher le bouton par Vue — sans lui, le radio natif resterait coché sur un mode refusé.
const pending = ref(null)
const current = computed(() => pending.value ?? auth.user?.sessionMode ?? 'persistent')

async function choose(mode) {
  if (mode === current.value || saving.value) return
  error.value   = ''
  saving.value  = true
  pending.value = mode
  try {
    const response = await api.put('/api/user/preferences', { sessionMode: mode })
    if (response.csrfToken) auth.setCsrfToken(response.csrfToken)
    auth.updateUser({ sessionMode: response.sessionMode })
    toasts.success(mode === 'strict'
      ? 'Connexion à chaque session activée. Vos autres appareils ont été déconnectés.'
      : 'Vous resterez connecté sur cet appareil.', { duration: 6000 })
  } catch (err) {
    error.value = err.message
  } finally {
    saving.value  = false
    pending.value = null
  }
}
</script>

<template>
  <section class="session-settings" aria-labelledby="session-settings-title">
    <BaseText id="session-settings-title" as="h2" size="sm" weight="semibold" color="primary">Session</BaseText>

    <AlertBanner v-if="error">{{ error }}</AlertBanner>

    <div class="session-settings__options" role="radiogroup" aria-labelledby="session-settings-title">
      <label
        v-for="mode in MODES"
        :key="mode.value"
        class="session-settings__option"
        :class="{ 'session-settings__option--active': current === mode.value }"
      >
        <BaseRadio
          name="session-mode"
          class="session-settings__radio"
          :value="mode.value"
          :model-value="current"
          :disabled="saving"
          @update:model-value="choose"
        />
        <span class="session-settings__text">
          <BaseText size="sm" weight="medium" color="primary">{{ mode.label }}</BaseText>
          <BaseText size="xs" color="muted">{{ mode.hint }}</BaseText>
        </span>
      </label>
    </div>
  </section>
</template>

<style scoped>
.session-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.session-settings__options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.session-settings__option {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}

.session-settings__option--active {
  border-color: var(--color-primary);
  background: var(--color-primary-subtle);
}

.session-settings__radio { margin-top: 0.2rem; }

.session-settings__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
