<script setup>
/*
 * Formulaire de création / modification d'une enveloppe, prévu pour vivre
 * dans une modale (FormModal). `envelope` : l'enveloppe à modifier, ou null
 * pour en créer une. `saved` / `cancel` préviennent le parent, qui ferme la
 * modale.
 */
import { ref } from 'vue'
import BaseButton  from '@/components/atoms/BaseButton.vue'
import BaseChip     from '@/components/atoms/BaseChip.vue'
import BaseInput    from '@/components/atoms/BaseInput.vue'
import AlertBanner  from '@/components/molecules/AlertBanner.vue'
import { useDirtyForm }      from '@/composables/useDirtyForm.js'
import { useCategoriesStore } from '@/stores/categories.store.js'
import { useEnvelopesStore }  from '@/stores/envelopes.store.js'
import { useToastStore }      from '@/stores/toast.store.js'
import { formatAmount, parseAmountToCents } from '@/utils/format.js'

const props = defineProps({
  envelope: { type: Object, default: null },
})

const emit = defineEmits(['saved', 'cancel'])

const categories = useCategoriesStore()
const envelopes   = useEnvelopesStore()
const toasts      = useToastStore()

function initialForm() {
  return {
    id:          props.envelope?.id ?? null,
    name:        props.envelope?.name ?? '',
    budget:      props.envelope?.budget ? String(props.envelope.budget / 100).replace('.', ',') : '',
    categoryIds: props.envelope?.categoryIds ?? [],
  }
}

const form         = ref(initialForm())
const error        = ref('')
const budgetError  = ref('')
const loading      = ref(false)

useDirtyForm(form)

function toggleCategory(id) {
  form.value.categoryIds = form.value.categoryIds.includes(id)
    ? form.value.categoryIds.filter((c) => c !== id)
    : [...form.value.categoryIds, id]
}

async function submit() {
  if (!form.value.name.trim()) {
    error.value = 'Le nom est requis.'
    return
  }

  const budget = parseAmountToCents(form.value.budget)
  if (budget === null) {
    budgetError.value = form.value.budget.trim() === '' ? 'Le montant est requis.' : 'Montant invalide (ex : 400).'
    return
  }

  loading.value = true
  error.value = ''
  budgetError.value = ''
  try {
    const payload = {
      name: form.value.name.trim(),
      budget,
      categoryIds: form.value.categoryIds,
    }
    const isEdit = Boolean(form.value.id)
    isEdit
      ? await envelopes.update(form.value.id, payload)
      : await envelopes.create(payload)
    toasts.success(isEdit ? 'Enveloppe modifiée.' : 'Enveloppe ajoutée.')
    emit('saved')
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="envelope-form" novalidate @submit.prevent="submit">
    <AlertBanner v-if="error">{{ error }}</AlertBanner>

    <BaseInput
      v-model="form.name"
      id="envelope-name"
      label="Nom"
      placeholder="Alimentation & sorties…"
      required
    />

    <BaseInput
      v-model="form.budget"
      id="envelope-budget"
      label="Montant alloué par mois (€)"
      placeholder="400"
      inputmode="decimal"
      hint="Idéalement financé par vos revenus du mois : une jauge apparaît sur l'accueil."
      :error="budgetError"
      required
    />

    <div class="envelope-form__categories">
      <span class="envelope-form__label">Catégories liées</span>
      <p v-if="!categories.items.length" class="envelope-form__empty">
        Aucune catégorie pour l'instant.
      </p>
      <div v-else class="envelope-form__chips">
        <BaseChip
          v-for="category in categories.items"
          :key="category.id"
          :active="form.categoryIds.includes(category.id)"
          @click="toggleCategory(category.id)"
        >
          {{ category.name }}
        </BaseChip>
      </div>
      <p v-if="form.categoryIds.length" class="envelope-form__hint">
        Une catégorie déjà liée à une autre enveloppe en sera détachée.
      </p>
    </div>

    <p v-if="form.budget" class="envelope-form__preview">
      {{ formatAmount(parseAmountToCents(form.budget) ?? 0) }} / mois pour cette enveloppe.
    </p>

    <div class="envelope-form__actions">
      <BaseButton type="submit" variant="primary" :loading="loading" full>
        {{ form.id ? 'Enregistrer' : 'Ajouter' }}
      </BaseButton>
      <BaseButton type="button" variant="ghost" full @click="emit('cancel')">
        Annuler
      </BaseButton>
    </div>
  </form>
</template>

<style scoped>
.envelope-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.envelope-form__categories {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.envelope-form__label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-primary);
}

.envelope-form__empty,
.envelope-form__hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.envelope-form__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.envelope-form__preview {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.envelope-form__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
