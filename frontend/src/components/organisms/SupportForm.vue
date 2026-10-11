<script setup>
/*
 * Ticket de support : un bug, une amélioration ou une autre demande, envoyé par email (POST /api/support).
 * Pour un bug, l'appareil et l'écran sont joints au message : de quoi le reproduire sans
 * avoir à le demander. La référence renvoyée par l'API est montrée à l'utilisateur.
 */
import { computed, ref } from 'vue'
import { useApi } from '@/composables/useApi.js'
import { useDirtyForm } from '@/composables/useDirtyForm.js'
import { useToastStore } from '@/stores/toast.store.js'
import BaseButton   from '@/components/atoms/BaseButton.vue'
import BaseChip     from '@/components/atoms/BaseChip.vue'
import BaseInput    from '@/components/atoms/BaseInput.vue'
import BaseText     from '@/components/atoms/BaseText.vue'
import BaseTextarea from '@/components/atoms/BaseTextarea.vue'
import AlertBanner  from '@/components/molecules/AlertBanner.vue'

const props = defineProps({
  /** Type choisi à l'ouverture : 'bug' | 'idea' | 'other' */
  kind: { type: String, default: 'bug' },
})

const SUBJECT_MAX = 120
const MESSAGE_MAX = 5000

const KINDS = {
  bug: {
    label: 'Bug',
    subject: 'Ce qui ne marche pas',
    subjectPlaceholder: 'Ex. : la barre du bas ne touche pas le bord',
    message: 'Que s\'est-il passé ?',
    messagePlaceholder: 'Ce que vous faisiez, ce qui s\'est passé, ce que vous attendiez.',
  },
  idea: {
    label: 'Amélioration',
    subject: 'Votre idée en une phrase',
    subjectPlaceholder: 'Ex. : comparer deux mois dans les statistiques',
    message: 'Dites-nous en plus',
    messagePlaceholder: 'À quoi cela vous servirait, comment vous l\'imaginez.',
  },
  other: {
    label: 'Autre',
    subject: 'Sujet',
    subjectPlaceholder: 'Ex. : une question sur mon compte',
    message: 'Votre message',
    messagePlaceholder: 'Dites-nous ce dont vous avez besoin.',
  },
}

const api    = useApi()
const toasts = useToastStore()

const noErrors = () => ({ subject: '', message: '', global: '' })

const form    = ref({ kind: KINDS[props.kind] ? props.kind : 'bug', subject: '', message: '' })
const errors  = ref(noErrors())
const loading = ref(false)
const sent    = ref('')

useDirtyForm(form)

const copy = computed(() => KINDS[form.value.kind])

/** Appareil et écran, joints à un bug pour pouvoir le reproduire. */
function deviceContext() {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
  return {
    'Appareil': navigator.userAgent.slice(0, 300),
    'Écran': `${window.screen.width}×${window.screen.height}, fenêtre ${window.innerWidth}×${window.innerHeight}`,
    'App installée': standalone ? 'oui' : 'non',
    'Thème': document.documentElement.dataset.theme ?? 'système',
  }
}

async function submit() {
  errors.value = noErrors()
  const subject = form.value.subject.trim()
  const message = form.value.message.trim()

  if (subject.length < 3) errors.value.subject = '3 caractères minimum.'
  if (message.length < 10) errors.value.message = '10 caractères minimum : décrivez en une ou deux phrases.'
  if (errors.value.subject || errors.value.message) return

  loading.value = true
  try {
    const { reference } = await api.post('/api/support', {
      kind: form.value.kind,
      subject,
      message,
      ...(form.value.kind === 'bug' && { context: deviceContext() }),
    })
    sent.value = reference
    form.value = { kind: form.value.kind, subject: '', message: '' }
    toasts.success('Merci, votre message est envoyé.')
  } catch (err) {
    errors.value.global = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div v-if="sent" class="support-form support-form--sent" role="status">
    <BaseText as="p" size="base" weight="semibold" color="primary">Merci, c'est envoyé.</BaseText>
    <BaseText as="p" size="sm" color="secondary">
      Référence <strong>{{ sent }}</strong>. La réponse arrivera sur l'adresse email de votre compte.
    </BaseText>
    <BaseButton variant="secondary" full @click="sent = ''">Envoyer un autre message</BaseButton>
  </div>

  <form v-else class="support-form" novalidate @submit.prevent="submit">
    <div class="support-form__kinds" role="group" aria-label="Type de message">
      <BaseChip
        v-for="(item, key) in KINDS"
        :key="key"
        shape="block"
        :active="form.kind === key"
        @click="form.kind = key"
      >
        {{ item.label }}
      </BaseChip>
    </div>

    <AlertBanner v-if="errors.global">{{ errors.global }}</AlertBanner>

    <BaseInput
      v-model="form.subject"
      id="support-subject"
      :label="copy.subject"
      :placeholder="copy.subjectPlaceholder"
      :maxlength="SUBJECT_MAX"
      :error="errors.subject"
      required
    />
    <BaseTextarea
      v-model="form.message"
      id="support-message"
      :label="copy.message"
      :placeholder="copy.messagePlaceholder"
      :maxlength="MESSAGE_MAX"
      :rows="6"
      hint="N'écrivez jamais votre mot de passe."
      :error="errors.message"
      required
    />

    <BaseText v-if="form.kind === 'bug'" as="p" size="xs" color="muted">
      Le modèle de votre appareil et la taille de l'écran sont joints au message, pour reproduire le problème.
    </BaseText>

    <BaseButton type="submit" variant="primary" :loading="loading" full>Envoyer</BaseButton>
  </form>
</template>

<style scoped>
.support-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.support-form--sent { gap: var(--space-3); }

.support-form__kinds {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
}
</style>
