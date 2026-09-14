<script setup>
import { onMounted, ref } from 'vue'
import BaseText   from '@/components/atoms/BaseText.vue'
import BaseButton from '@/components/atoms/BaseButton.vue'
import BaseIcon   from '@/components/atoms/BaseIcon.vue'
import TransactionList   from '@/components/organisms/TransactionList.vue'
import TransactionForm   from '@/components/organisms/TransactionForm.vue'
import TransactionDetail from '@/components/organisms/TransactionDetail.vue'
import { useTransactionsStore } from '@/stores/transactions.store.js'
import { useCategoriesStore }   from '@/stores/categories.store.js'
import { formatAmount } from '@/utils/format.js'

const transactions = useTransactionsStore()
const categories   = useCategoriesStore()

const showForm = ref(false)
const editing  = ref(null)
/** Transaction en cours d'aperçu (clic sur une ligne) — avant de passer à l'édition. */
const viewing  = ref(null)

function openCreate() {
  editing.value  = null
  showForm.value = true
}

function openEdit(transaction) {
  viewing.value  = null
  editing.value  = transaction
  showForm.value = true
}

function closeForm() {
  showForm.value = false
  editing.value  = null
}

onMounted(() => {
  transactions.fetchAll()
  categories.fetchAll().catch(() => {})
})
</script>

<template>
  <section class="transactions">
    <header class="transactions__head">
      <div>
        <BaseText as="h1" size="2xl" weight="bold" color="primary">Transactions</BaseText>
        <BaseText as="p" size="sm" color="muted">
          {{ transactions.total }}
          {{ transactions.total > 1 ? 'opérations' : 'opération' }}
        </BaseText>
      </div>

      <BaseButton v-if="!showForm" variant="primary" @click="openCreate">
        <BaseIcon name="plus" :size="18" />
        Ajouter
      </BaseButton>
    </header>

    <TransactionForm
      v-if="showForm"
      :transaction="editing"
      @saved="transactions.fetchAll()"
      @deleted="transactions.fetchAll()"
      @close="closeForm"
    />

    <!-- Filtres -->
    <div class="filters">
      <div class="filters__group" role="group" aria-label="Filtrer par type">
        <button
          v-for="option in [
            { value: '',        label: 'Tout'     },
            { value: 'expense', label: 'Dépenses' },
            { value: 'income',  label: 'Revenus'  },
          ]"
          :key="option.value"
          type="button"
          class="filters__chip"
          :class="{ 'filters__chip--active': transactions.filters.type === option.value }"
          :aria-pressed="transactions.filters.type === option.value"
          @click="transactions.setFilter('type', option.value)"
        >
          {{ option.label }}
        </button>
      </div>

      <select
        :value="transactions.filters.categoryId"
        class="filters__select"
        aria-label="Filtrer par catégorie"
        @change="transactions.setFilter('categoryId', $event.target.value)"
      >
        <option value="">Toutes les catégories</option>
        <option value="none">Sans catégorie</option>
        <option v-for="category in categories.flatOptions" :key="category.id" :value="category.id">
          {{ category.label }}
        </option>
      </select>

      <div class="filters__dates">
        <input
          type="date"
          :value="transactions.filters.from"
          class="filters__date"
          aria-label="Depuis le"
          :max="transactions.filters.to || undefined"
          @change="transactions.setFilter('from', $event.target.value)"
        />
        <BaseText size="sm" color="muted">→</BaseText>
        <input
          type="date"
          :value="transactions.filters.to"
          class="filters__date"
          aria-label="Jusqu'au"
          :min="transactions.filters.from || undefined"
          @change="transactions.setFilter('to', $event.target.value)"
        />
      </div>

      <button
        v-if="transactions.hasFilters"
        type="button"
        class="filters__reset"
        @click="transactions.resetFilters()"
      >
        Réinitialiser
      </button>
    </div>

    <div v-if="transactions.error" class="transactions__error" role="alert">
      <BaseText size="sm" color="danger">{{ transactions.error }}</BaseText>
    </div>

    <TransactionList
      :transactions="transactions.items"
      :loading="transactions.loading"
      clickable
      :empty-label="transactions.hasFilters
        ? 'Aucune transaction ne correspond à ces filtres.'
        : 'Aucune transaction — commencez par en ajouter une.'"
      @select="viewing = $event"
    />

    <BaseText v-if="transactions.items.length" as="p" size="xs" color="muted" class="transactions__total">
      Total affiché :
      {{ formatAmount(transactions.items.reduce((sum, t) => sum + (t.type === 'expense' ? -t.amount : t.amount), 0)) }}
    </BaseText>

    <TransactionDetail
      v-if="viewing"
      :transaction="viewing"
      @edit="openEdit(viewing)"
      @close="viewing = null"
    />
  </section>
</template>

<style scoped>
.transactions {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 42rem;
  margin: 0 auto;
  width: 100%;
}

.transactions__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.transactions__error {
  background: var(--color-danger-subtle);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.filters__group {
  display: flex;
  gap: var(--space-2);
}

.filters__chip {
  padding: var(--space-2) var(--space-3);
  min-height: 2.25rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  transition: color var(--transition-fast), border-color var(--transition-fast),
              background var(--transition-fast);
}

.filters__chip--active {
  border-color: var(--color-primary);
  background: var(--color-primary-subtle);
  color: var(--color-primary);
}

.filters__select {
  flex: 1;
  min-width: 10rem;
  min-height: 2.25rem;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
  font-size: var(--text-sm);
}

.filters__dates {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.filters__date {
  min-height: 2.25rem;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  color: var(--color-text-primary);
  font-size: var(--text-sm);
}

.filters__reset {
  padding: var(--space-2) var(--space-3);
  min-height: 2.25rem;
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: var(--text-sm);
  transition: color var(--transition-fast), background var(--transition-fast);
}

.filters__reset:hover {
  color: var(--color-danger);
  background: var(--color-danger-subtle);
}

.transactions__total {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
