<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import BaseText   from '@/components/atoms/BaseText.vue'
import BaseButton from '@/components/atoms/BaseButton.vue'
import BaseIcon   from '@/components/atoms/BaseIcon.vue'
import BaseInput  from '@/components/atoms/BaseInput.vue'
import FabButton  from '@/components/atoms/FabButton.vue'
import TransactionList    from '@/components/organisms/TransactionList.vue'
import FormModal          from '@/components/organisms/FormModal.vue'
import TransactionForm    from '@/components/organisms/TransactionForm.vue'
import DateRangePicker    from '@/components/molecules/DateRangePicker.vue'
import BaseChip   from '@/components/atoms/BaseChip.vue'
import BaseSelect from '@/components/atoms/BaseSelect.vue'
import AlertBanner from '@/components/molecules/AlertBanner.vue'
import { useTransactionsStore } from '@/stores/transactions.store.js'
import { useCategoriesStore }   from '@/stores/categories.store.js'
import { formatAmount } from '@/utils/format.js'

const transactions = useTransactionsStore()
const categories   = useCategoriesStore()

const route  = useRoute()
const router = useRouter()

const searching = computed(() => transactions.search.trim() !== '')

/** Modale de saisie : ouverte pour créer (`editing` null) ou pour modifier la ligne touchée. */
const modalOpen = ref(false)
const editing   = ref(null)

function openCreate() {
  editing.value   = null
  modalOpen.value = true
}

function openEdit(transaction) {
  editing.value   = transaction
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  editing.value   = null
}

function onSaved() {
  transactions.fetchAll()
  closeModal()
}

onMounted(() => {
  // Raccourci de l'app installée (« Ajouter une transaction ») : /transactions?new=1
  if ('new' in route.query) {
    openCreate()
    router.replace({ query: {} })
  }

  transactions.fetchAll()
  categories.fetchAll().catch(() => {})
})
</script>

<template>
  <section class="transactions">
    <!-- Fixe : titre, bouton d'ajout et filtres — seules les cartes défilent en dessous. -->
    <div class="transactions__sticky">
      <header class="transactions__head">
        <div>
          <BaseText as="h1" size="2xl" weight="bold" color="primary">Transactions</BaseText>
          <BaseText as="p" size="sm" color="muted">
            <template v-if="searching">
              {{ transactions.visibleItems.length }}
              {{ transactions.visibleItems.length > 1 ? 'résultats' : 'résultat' }}
            </template>
            <template v-else>
              {{ transactions.total }}
              {{ transactions.total > 1 ? 'opérations' : 'opération' }}
            </template>
          </BaseText>
        </div>

        <BaseButton class="transactions__add" variant="primary" @click="openCreate">
          <BaseIcon name="plus" :size="18" />
          Ajouter
        </BaseButton>
      </header>

      <BaseInput
        :model-value="transactions.search"
        type="search"
        label="Rechercher une transaction"
        hide-label
        placeholder="Rechercher un libellé, une note…"
        @update:model-value="transactions.setSearch($event).catch(() => {})"
      />

      <div class="filters">
        <div class="filters__group" role="group" aria-label="Filtrer par type">
          <BaseChip
            v-for="option in [
              { value: '',        label: 'Tout'     },
              { value: 'expense', label: 'Dépenses' },
              { value: 'income',  label: 'Revenus'  },
            ]"
            :key="option.value"
            :active="transactions.filters.type === option.value"
            @click="transactions.setFilter('type', option.value)"
          >
            {{ option.label }}
          </BaseChip>
        </div>

        <div class="filters__select">
          <BaseSelect
            :model-value="transactions.filters.categoryId"
            size="sm"
            aria-label="Filtrer par catégorie"
            @update:model-value="transactions.setFilter('categoryId', $event)"
          >
            <option value="">Toutes les catégories</option>
            <option value="none">Sans catégorie</option>
            <option v-for="category in categories.flatOptions" :key="category.id" :value="category.id">
              {{ category.label }}
            </option>
          </BaseSelect>
        </div>

        <DateRangePicker
          :from="transactions.filters.from"
          :to="transactions.filters.to"
          @change="transactions.setDateRange($event)"
        />

        <BaseButton v-if="transactions.hasFilters" variant="ghost" size="sm" @click="transactions.resetFilters()">
          Réinitialiser
        </BaseButton>
      </div>
    </div>

    <AlertBanner v-if="transactions.error">{{ transactions.error }}</AlertBanner>

    <TransactionList
      :transactions="transactions.visibleItems"
      :loading="transactions.loading"
      clickable
      :empty-label="transactions.hasFilters
        ? 'Aucune transaction ne correspond à ces filtres.'
        : 'Aucune transaction — commencez par en ajouter une.'"
      @select="openEdit"
    />

    <BaseButton
      v-if="transactions.hasMore && (!searching || transactions.error)"
      variant="secondary"
      full
      :loading="transactions.loadingMore"
      @click="transactions.loadMore().catch(() => {})"
    >
      Charger plus ({{ transactions.remaining }} restantes)
    </BaseButton>

    <BaseText v-if="transactions.visibleItems.length" as="p" size="xs" color="muted" class="transactions__total">
      Total affiché :
      {{ formatAmount(transactions.visibleItems.reduce((sum, t) => sum + (t.type === 'expense' ? -t.amount : t.amount), 0)) }}
    </BaseText>

    <FabButton label="Ajouter une transaction" @click="openCreate" />

    <FormModal
      v-if="modalOpen"
      :title="editing ? 'Modifier la transaction' : 'Nouvelle transaction'"
      @close="closeModal"
    >
      <TransactionForm
        :transaction="editing"
        @saved="onSaved"
        @deleted="onSaved"
        @cancel="closeModal"
      />
    </FormModal>
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

.transactions__sticky {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding-top: var(--space-1);
  padding-bottom: var(--space-3);
  background: var(--color-bg-base);
}

.transactions__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
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

.filters__select {
  flex: 1;
  min-width: 10rem;
}

/* Mobile : l'ajout passe par le bouton flottant ; « Ajouter » ne sert qu'à partir de 1024 px. */
.transactions__add { display: none; }

@media (min-width: 1024px) {
  .transactions__add { display: inline-flex; }
}

.transactions__total {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
</style>
