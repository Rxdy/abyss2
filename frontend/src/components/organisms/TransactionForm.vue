<script setup>
import { computed, ref, watch } from 'vue'
import BaseInput  from '@/components/atoms/BaseInput.vue'
import BaseButton from '@/components/atoms/BaseButton.vue'
import BaseText   from '@/components/atoms/BaseText.vue'
import { useTransactionsStore } from '@/stores/transactions.store.js'
import { useCategoriesStore }   from '@/stores/categories.store.js'
import { parseAmountToCents, todayISO } from '@/utils/format.js'

const props = defineProps({
  /** Transaction à modifier — absente = création */
  transaction: { type: Object, default: null },
})

const emit = defineEmits(['saved', 'deleted', 'close'])

const transactions = useTransactionsStore()
const categories   = useCategoriesStore()

const isEdit = computed(() => !!props.transaction)

const form = ref({
  title: '',
  amount: '',
  date: todayISO(),
  type: 'expense',
  categoryId: '',
})

const errors  = ref({ title: '', amount: '', global: '' })
const loading = ref(false)

/** Recharge le formulaire quand on passe d'une transaction à l'autre. */
watch(
  () => props.transaction,
  (transaction) => {
    form.value = transaction
      ? {
          title: transaction.title,
          amount: String(transaction.amount / 100).replace('.', ','),
          date: transaction.date,
          type: transaction.type,
          categoryId: transaction.category?.id ?? '',
        }
      : { title: '', amount: '', date: todayISO(), type: 'expense', categoryId: '' }
    errors.value = { title: '', amount: '', global: '' }
  },
  { immediate: true }
)

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
  }

  try {
    const saved = isEdit.value
      ? await transactions.update(props.transaction.id, payload)
      : await transactions.create(payload)

    emit('saved', saved)
    emit('close')
  } catch (err) {
    errors.value.global = err.message
  } finally {
    loading.value = false
  }
}

async function remove() {
  loading.value = true
  try {
    await transactions.remove(props.transaction.id)
    emit('deleted', props.transaction.id)
    emit('close')
  } catch (err) {
    errors.value.global = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="transaction-form" novalidate @submit.prevent="submit">
    <BaseText as="h2" size="lg" weight="semibold" color="primary">
      {{ isEdit ? 'Modifier la transaction' : 'Nouvelle transaction' }}
    </BaseText>

    <div v-if="errors.global" class="transaction-form__error" role="alert">
      <BaseText size="sm" color="danger">{{ errors.global }}</BaseText>
    </div>

    <div class="transaction-form__types" role="group" aria-label="Type de transaction">
      <button
        type="button"
        class="type-toggle"
        :class="{ 'type-toggle--active': form.type === 'expense' }"
        :aria-pressed="form.type === 'expense'"
        @click="form.type = 'expense'"
      >
        Dépense
      </button>
      <button
        type="button"
        class="type-toggle"
        :class="{ 'type-toggle--active': form.type === 'income' }"
        :aria-pressed="form.type === 'income'"
        @click="form.type = 'income'"
      >
        Revenu
      </button>
    </div>

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

    <div class="field">
      <label class="field__label" for="transaction-category">Catégorie</label>
      <select id="transaction-category" v-model="form.categoryId" class="field__select">
        <option value="">Aucune</option>
        <option v-for="category in categories.flatOptions" :key="category.id" :value="category.id">
          {{ category.label }}
        </option>
      </select>
    </div>

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
        @click="remove"
      >
        Supprimer
      </BaseButton>

      <BaseButton type="button" variant="ghost" full @click="$emit('close')">
        Annuler
      </BaseButton>
    </div>
  </form>
</template>

<style scoped>
.transaction-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.transaction-form__error {
  background: var(--color-danger-subtle);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}

.transaction-form__types {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}

.type-toggle {
  padding: var(--space-3);
  min-height: 2.75rem;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg-elevated);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  transition: color var(--transition-fast), border-color var(--transition-fast),
              background var(--transition-fast);
}

.type-toggle--active {
  border-color: var(--color-primary);
  background: var(--color-primary-subtle);
  color: var(--color-primary);
}

.field { display: flex; flex-direction: column; gap: var(--space-2); }

.field__label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
}

.field__select {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  min-height: 2.75rem;
  color: var(--color-text-primary);
  font-size: var(--text-base);
}

.field__select:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px var(--color-primary-ring);
}

.transaction-form__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
