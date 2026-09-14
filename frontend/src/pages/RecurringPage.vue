<script setup>
import { computed, onMounted, ref } from 'vue'
import BaseText      from '@/components/atoms/BaseText.vue'
import BaseInput     from '@/components/atoms/BaseInput.vue'
import BaseButton    from '@/components/atoms/BaseButton.vue'
import BaseIcon      from '@/components/atoms/BaseIcon.vue'
import ConfirmDialog  from '@/components/molecules/ConfirmDialog.vue'
import { useRecurringStore }  from '@/stores/recurring.store.js'
import { useCategoriesStore } from '@/stores/categories.store.js'
import { formatSignedAmount, formatDate, parseAmountToCents, todayISO } from '@/utils/format.js'

const recurring  = useRecurringStore()
const categories = useCategoriesStore()

function emptyForm() {
  return {
    id: null,
    title: '',
    amount: '',
    type: 'expense',
    dayOfMonth: '1',
    categoryId: '',
    startDate: todayISO(),
    endDate: '',
  }
}

const form    = ref(emptyForm())
const errors  = ref({ title: '', amount: '', dayOfMonth: '', global: '' })
const loading = ref(false)

function reset() {
  form.value = emptyForm()
  errors.value = { title: '', amount: '', dayOfMonth: '', global: '' }
}

function edit(item) {
  form.value = {
    id: item.id,
    title: item.title,
    amount: String(item.amount / 100).replace('.', ','),
    type: item.type,
    dayOfMonth: String(item.dayOfMonth),
    categoryId: item.category?.id ?? '',
    startDate: item.startDate,
    endDate: item.endDate ?? '',
  }
  errors.value = { title: '', amount: '', dayOfMonth: '', global: '' }
}

function validate() {
  errors.value = { title: '', amount: '', dayOfMonth: '', global: '' }
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
    form.value.id
      ? await recurring.update(form.value.id, payload)
      : await recurring.create(payload)
    reset()
  } catch (err) {
    errors.value.global = err.message
  } finally {
    loading.value = false
  }
}

async function toggle(item) {
  try {
    await recurring.toggleActive(item)
  } catch (err) {
    errors.value.global = err.message
  }
}

const pendingDelete = ref(null)
const deleteLoading  = ref(false)

function askRemove(item) {
  pendingDelete.value = item
}

async function confirmRemove() {
  if (!pendingDelete.value) return

  deleteLoading.value = true
  try {
    await recurring.remove(pendingDelete.value.id)
    if (form.value.id === pendingDelete.value.id) reset()
    pendingDelete.value = null
  } catch (err) {
    errors.value.global = err.message
  } finally {
    deleteLoading.value = false
  }
}

const netLabel = computed(() => (recurring.monthlyNet >= 0 ? 'success' : 'danger'))

onMounted(() => {
  recurring.fetchAll({ force: true }).catch(() => {})
  categories.fetchAll().catch(() => {})
})
</script>

<template>
  <section class="recurring">
    <header class="recurring__head">
      <RouterLink to="/profile" class="recurring__back">
        <BaseText size="sm" color="muted">← Profil</BaseText>
      </RouterLink>
      <BaseText as="h1" size="2xl" weight="bold" color="primary">Dépenses &amp; revenus fixes</BaseText>
      <BaseText as="p" size="sm" color="muted">
        Loyer, salaire, abonnements… Chaque mois, dès que le jour d'échéance
        arrive, une transaction est créée automatiquement. La supprimer ou la
        modifier ne touche jamais aux transactions déjà générées.
      </BaseText>
    </header>

    <div v-if="recurring.items.length" class="recurring__summary">
      <BaseText size="xs" color="muted">Impact mensuel net (actifs)</BaseText>
      <BaseText size="xl" weight="bold" :color="netLabel">
        {{ formatSignedAmount(Math.abs(recurring.monthlyNet), recurring.monthlyNet < 0 ? 'expense' : 'income') }}
      </BaseText>
    </div>

    <div v-if="errors.global || recurring.error" class="recurring__error" role="alert">
      <BaseText size="sm" color="danger">{{ errors.global || recurring.error }}</BaseText>
    </div>

    <!-- Création / édition -->
    <form class="recurring__form" novalidate @submit.prevent="submit">
      <BaseText as="h2" size="base" weight="semibold" color="primary">
        {{ form.id ? 'Modifier' : 'Nouvelle charge fixe' }}
      </BaseText>

      <div class="recurring__types" role="group" aria-label="Type">
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

      <div class="field">
        <label class="field__label" for="recurring-category">Catégorie</label>
        <select id="recurring-category" v-model="form.categoryId" class="field__select">
          <option value="">Aucune</option>
          <option v-for="category in categories.flatOptions" :key="category.id" :value="category.id">
            {{ category.label }}
          </option>
        </select>
      </div>

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

      <div class="recurring__actions">
        <BaseButton type="submit" variant="primary" :loading="loading" full>
          {{ form.id ? 'Enregistrer' : 'Ajouter' }}
        </BaseButton>
        <BaseButton v-if="form.id" type="button" variant="ghost" full @click="reset">
          Annuler
        </BaseButton>
      </div>
    </form>

    <!-- Liste -->
    <ul v-if="recurring.items.length" class="recurring__list">
      <li v-for="item in recurring.items" :key="item.id" class="item" :class="{ 'item--paused': !item.active }">
        <span
          class="item__color"
          :style="{ background: item.category?.color ?? 'var(--color-text-muted)' }"
          aria-hidden="true"
        />

        <div class="item__body">
          <BaseText size="sm" weight="medium" color="primary" truncate>{{ item.title }}</BaseText>
          <BaseText size="xs" color="muted">
            Le {{ item.dayOfMonth }} de chaque mois
            <template v-if="item.category"> · {{ item.category.name }}</template>
            <template v-if="!item.active"> · en pause</template>
            <template v-else-if="item.nextDate"> · prochaine le {{ formatDate(item.nextDate) }}</template>
            <template v-else> · terminée</template>
          </BaseText>
        </div>

        <BaseText
          size="sm"
          weight="semibold"
          :color="item.type === 'expense' ? 'danger' : 'success'"
          class="item__amount"
        >
          {{ formatSignedAmount(item.amount, item.type) }}
        </BaseText>

        <button
          type="button"
          class="item__action"
          :aria-label="item.active ? `Mettre en pause ${item.title}` : `Reprendre ${item.title}`"
          @click="toggle(item)"
        >
          <BaseIcon :name="item.active ? 'clock' : 'plus'" :size="16" />
        </button>
        <button type="button" class="item__action" :aria-label="`Modifier ${item.title}`" @click="edit(item)">
          <BaseIcon name="tag" :size="16" />
        </button>
        <button type="button" class="item__action item__action--danger" :aria-label="`Supprimer ${item.title}`" @click="askRemove(item)">
          <BaseIcon name="logout" :size="16" />
        </button>
      </li>
    </ul>

    <BaseText v-else-if="!recurring.loading" as="p" size="sm" color="muted">
      Aucune dépense ou revenu fixe pour l'instant.
    </BaseText>

    <ConfirmDialog
      v-if="pendingDelete"
      :title="`Supprimer « ${pendingDelete.title} » ?`"
      confirm-label="Supprimer"
      danger
      :loading="deleteLoading"
      @cancel="pendingDelete = null"
      @confirm="confirmRemove"
    >
      <BaseText size="sm" color="secondary">
        Aucune transaction déjà générée n'est supprimée — seules les
        prochaines échéances mensuelles s'arrêtent.
      </BaseText>
    </ConfirmDialog>
  </section>
</template>

<style scoped>
.recurring {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 32rem;
  margin: 0 auto;
  width: 100%;
}

.recurring__head {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.recurring__back { align-self: flex-start; }

.recurring__summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4) var(--space-5);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.recurring__error {
  background: var(--color-danger-subtle);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}

.recurring__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.recurring__types {
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

.recurring__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.recurring__list {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
}

.item + .item { border-top: 1px solid var(--color-border); }

.item--paused { opacity: 0.55; }

.item__color {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.item__body { flex: 1; min-width: 0; }
.item__amount { font-variant-numeric: tabular-nums; white-space: nowrap; }

.item__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  transition: color var(--transition-fast), background var(--transition-fast);
}

.item__action:hover {
  color: var(--color-primary);
  background: var(--color-primary-subtle);
}

.item__action--danger:hover {
  color: var(--color-danger);
  background: var(--color-danger-subtle);
}
</style>
