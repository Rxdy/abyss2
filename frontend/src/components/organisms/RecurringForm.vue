<script setup>
/*
 * Formulaire de création / modification d'une charge fixe, prévu pour vivre
 * dans une modale (FormModal). `item` : la charge à modifier, ou null pour en
 * créer une. `saved` / `cancel` préviennent le parent, qui ferme la modale.
 */
import { ref } from 'vue'
import BaseButton  from '@/components/atoms/BaseButton.vue'
import BaseInput   from '@/components/atoms/BaseInput.vue'
import BaseSelect  from '@/components/atoms/BaseSelect.vue'
import AlertBanner from '@/components/molecules/AlertBanner.vue'
import TypeToggle  from '@/components/molecules/TypeToggle.vue'
import { useDirtyForm }        from '@/composables/useDirtyForm.js'
import { useCategoriesStore } from '@/stores/categories.store.js'
import { useRecurringStore }  from '@/stores/recurring.store.js'
import { useToastStore }      from '@/stores/toast.store.js'
import { parseAmountToCents, todayISO } from '@/utils/format.js'

const props = defineProps({
  item: { type: Object, default: null },
})

const emit = defineEmits(['saved', 'cancel'])

const recurring  = useRecurringStore()
const categories = useCategoriesStore()
const toasts     = useToastStore()

const noErrors = () => ({ title: '', amount: '', dayOfMonth: '', global: '' })

function initialForm() {
  const item = props.item
  return {
    id:         item?.id ?? null,
    title:      item?.title ?? '',
    amount:     item ? String(item.amount / 100).replace('.', ',') : '',
    type:       item?.type ?? 'expense',
    dayOfMonth: item ? String(item.dayOfMonth) : '1',
    categoryId: item?.category?.id ?? '',
    startDate:  item?.startDate ?? todayISO(),
    endDate:    item?.endDate ?? '',
  }
}

const form    = ref(initialForm())
const errors  = ref(noErrors())
const loading = ref(false)

useDirtyForm(form)

function validate() {
  errors.value = noErrors()
  let ok = true

  if (!form.value.title.trim()) {
    errors.value.title = 'Le libellé est requis.'
    ok = false
  }
  if (parseAmountToCents(form.value.amount) === null) {
    errors.value.amount = 'Montant invalide (ex : 42,50).'
    ok = false
  }
  const day = Number(form.value.dayOfMonth)
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    errors.value.dayOfMonth = 'Jour du mois entre 1 et 31.'
    ok = false
  }
  return ok
}

async function submit() {
  if (!validate()) return

  loading.value = true
  const payload = {
    title:      form.value.title.trim(),
    amount:     parseAmountToCents(form.value.amount),
    type:       form.value.type,
    dayOfMonth: Number(form.value.dayOfMonth),
    categoryId: form.value.categoryId || null,
    startDate:  form.value.startDate,
    endDate:    form.value.endDate || null,
  }

  try {
    const isEdit = Boolean(form.value.id)
    isEdit
      ? await recurring.update(form.value.id, payload)
      : await recurring.create(payload)
    toasts.success(isEdit ? 'Charge fixe modifiée.' : 'Charge fixe ajoutée.')
    emit('saved')
  } catch (err) {
    errors.value.global = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="recurring-form" novalidate @submit.prevent="submit">
    <AlertBanner v-if="errors.global">{{ errors.global }}</AlertBanner>

    <TypeToggle v-model="form.type" aria-label="Type" />

    <BaseInput
      v-model="form.title"
      id="recurring-title"
      label="Libellé"
      placeholder="Loyer, salaire, Netflix…"
      :error="errors.title"
      required
    />

    <BaseInput
      v-model="form.amount"
      id="recurring-amount"
      label="Montant (€)"
      placeholder="42,50"
      inputmode="decimal"
      :error="errors.amount"
      required
    />

    <BaseInput
      v-model="form.dayOfMonth"
      id="recurring-day"
      type="number"
      label="Jour du mois"
      hint="Ramené au dernier jour du mois si celui-ci est plus court (ex : 31 → 30 avril)."
      :error="errors.dayOfMonth"
      required
    />

    <BaseSelect v-model="form.categoryId" id="recurring-category" label="Catégorie">
      <option value="">Aucune</option>
      <option v-for="category in categories.flatOptions" :key="category.id" :value="category.id">
        {{ category.label }}
      </option>
    </BaseSelect>

    <BaseInput
      v-model="form.startDate"
      id="recurring-start"
      type="date"
      label="Depuis le"
      required
    />

    <BaseInput
      v-model="form.endDate"
      id="recurring-end"
      type="date"
      label="Jusqu'au (optionnel)"
      hint="Laisser vide pour une charge sans fin prévue."
    />

    <div class="recurring-form__actions">
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
.recurring-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.recurring-form__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
