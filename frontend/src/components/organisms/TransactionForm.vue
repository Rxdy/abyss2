<script setup>
/*
 * Formulaire de création / modification d'une transaction, prévu pour vivre
 * dans une modale (FormModal). `transaction` : à modifier, ou null pour créer.
 * `saved` / `deleted` / `cancel` préviennent le parent, qui ferme la modale.
 */
import { computed, ref } from 'vue'
import BaseInput  from '@/components/atoms/BaseInput.vue'
import BaseButton from '@/components/atoms/BaseButton.vue'
import BaseText   from '@/components/atoms/BaseText.vue'
import BaseSelect  from '@/components/atoms/BaseSelect.vue'
import AlertBanner from '@/components/molecules/AlertBanner.vue'
import ConfirmDialog from '@/components/molecules/ConfirmDialog.vue'
import TypeToggle  from '@/components/molecules/TypeToggle.vue'
import { useDirtyForm } from '@/composables/useDirtyForm.js'
import { useTransactionsStore } from '@/stores/transactions.store.js'
import { useCategoriesStore }   from '@/stores/categories.store.js'
import { useCoinDropStore }     from '@/stores/coinDrop.store.js'
import { useToastStore }        from '@/stores/toast.store.js'
import { parseAmountToCents, todayISO } from '@/utils/format.js'

const props = defineProps({
  /** Transaction à modifier — absente = création */
  transaction: { type: Object, default: null },
})

const emit = defineEmits(['saved', 'deleted', 'cancel'])

const transactions = useTransactionsStore()
const categories   = useCategoriesStore()
const coinDrop      = useCoinDropStore()
const toasts       = useToastStore()

const isEdit = computed(() => !!props.transaction)

function initialForm() {
  const t = props.transaction
  return {
    title:      t?.title ?? '',
    amount:     t ? String(t.amount / 100).replace('.', ',') : '',
    date:       t?.date ?? todayISO(),
    type:       t?.type ?? 'expense',
    categoryId: t?.category?.id ?? '',
    note:       t?.note ?? '',
  }
}

const form    = ref(initialForm())
const errors  = ref({ title: '', amount: '', global: '' })
const loading = ref(false)

useDirtyForm(form)

function validate() {
  errors.value = { title: '', amount: '', global: '' }
  let ok = true

  if (!form.value.title.trim()) {
    errors.value.title = 'Le libellé est requis.'
    ok = false
  }
  if (parseAmountToCents(form.value.amount) === null) {
    errors.value.amount = 'Montant invalide (ex : 42,50).'
    ok = false
  }
  return ok
}

async function submit() {
  if (!validate()) return
  loading.value = true

  const payload = {
    title: form.value.title.trim(),
    amount: parseAmountToCents(form.value.amount),
    date: form.value.date,
    type: form.value.type,
    categoryId: form.value.categoryId || null,
    note: form.value.note.trim() || null,
  }

  try {
    const saved = isEdit.value
      ? await transactions.update(props.transaction.id, payload)
      : await transactions.create(payload)

    toasts.success(isEdit.value ? 'Transaction modifiée.' : 'Transaction ajoutée.')
    if (!isEdit.value) coinDrop.trigger()
    emit('saved', saved)
  } catch (err) {
    errors.value.global = err.message
  } finally {
    loading.value = false
  }
}

const confirmingDelete = ref(false)

async function remove() {
  loading.value = true
  try {
    await transactions.remove(props.transaction.id)
    toasts.success('Transaction supprimée.')
    emit('deleted', props.transaction.id)
  } catch (err) {
    confirmingDelete.value = false
    errors.value.global = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="transaction-form" novalidate @submit.prevent="submit">
    <AlertBanner v-if="errors.global">{{ errors.global }}</AlertBanner>

    <BaseText v-if="transaction?.recurringId" as="p" size="xs" color="muted">
      Générée automatiquement par une charge fixe.
    </BaseText>

    <TypeToggle v-model="form.type" aria-label="Type de transaction" />

    <BaseInput
      v-model="form.title"
      id="transaction-title"
      label="Libellé"
      placeholder="Courses, loyer, salaire…"
      :error="errors.title"
      required
    />

    <BaseInput
      v-model="form.amount"
      id="transaction-amount"
      label="Montant (€)"
      placeholder="42,50"
      inputmode="decimal"
      :error="errors.amount"
      required
    />

    <BaseInput
      v-model="form.date"
      id="transaction-date"
      type="date"
      label="Date"
      required
    />

    <BaseSelect v-model="form.categoryId" id="transaction-category" label="Catégorie">
      <option value="">Aucune</option>
      <option v-for="category in categories.flatOptions" :key="category.id" :value="category.id">
        {{ category.label }}
      </option>
    </BaseSelect>

    <BaseInput
      v-model="form.note"
      id="transaction-note"
      label="Note (optionnelle)"
    />

    <div class="transaction-form__actions">
      <BaseButton type="submit" variant="primary" :loading="loading" full>
        {{ isEdit ? 'Enregistrer' : 'Ajouter' }}
      </BaseButton>

      <BaseButton
        v-if="isEdit"
        type="button"
        variant="danger"
        :disabled="loading"
        full
        @click="confirmingDelete = true"
      >
        Supprimer
      </BaseButton>

      <BaseButton type="button" variant="ghost" full @click="emit('cancel')">
        Annuler
      </BaseButton>
    </div>
  </form>

  <ConfirmDialog
    v-if="confirmingDelete"
    title="Supprimer cette transaction ?"
    confirm-label="Supprimer"
    danger
    :loading="loading"
    @cancel="confirmingDelete = false"
    @confirm="remove"
  >
    <BaseText size="sm" color="secondary">
      « {{ transaction.title }} » sera supprimée définitivement.
    </BaseText>
  </ConfirmDialog>
</template>

<style scoped>
.transaction-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.transaction-form__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
