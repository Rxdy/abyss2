<script setup>
import { onMounted, ref } from 'vue'
import BaseText   from '@/components/atoms/BaseText.vue'
import BaseButton from '@/components/atoms/BaseButton.vue'
import BaseIcon   from '@/components/atoms/BaseIcon.vue'
import BalanceCard      from '@/components/molecules/BalanceCard.vue'
import TransactionList  from '@/components/organisms/TransactionList.vue'
import TransactionForm  from '@/components/organisms/TransactionForm.vue'
import { useTransactionsStore } from '@/stores/transactions.store.js'
import { useCategoriesStore }   from '@/stores/categories.store.js'

const transactions = useTransactionsStore()
const categories   = useCategoriesStore()

const showForm = ref(false)

async function refresh() {
  await transactions.fetchSummary()
}

function onSaved() {
  refresh()
}

onMounted(() => {
  refresh()
  // Nécessaires au formulaire d'ajout
  categories.fetchAll().catch(() => {})
})
</script>

<template>
  <section class="home">
    <!-- Récapitulatif -->
    <BalanceCard
      :balance="transactions.summary.balance"
      :month-income="transactions.summary.monthIncome"
      :month-expense="transactions.summary.monthExpense"
      :month="transactions.summary.month"
    />

    <div v-if="transactions.error" class="home__error" role="alert">
      <BaseText size="sm" color="danger">{{ transactions.error }}</BaseText>
    </div>

    <!-- Ajout rapide -->
    <BaseButton v-if="!showForm" variant="primary" full @click="showForm = true">
      <BaseIcon name="plus" :size="18" />
      Ajouter une transaction
    </BaseButton>

    <TransactionForm
      v-else
      @saved="onSaved"
      @close="showForm = false"
    />

    <!-- Dernières transactions -->
    <div class="home__section">
      <div class="home__section-head">
        <BaseText as="h2" size="lg" weight="semibold" color="primary">
          Dernières transactions
        </BaseText>
        <RouterLink to="/transactions" class="home__link">
          <BaseText size="sm" color="brand" weight="medium">Tout voir</BaseText>
          <BaseIcon name="chevron" :size="16" />
        </RouterLink>
      </div>

      <TransactionList
        :transactions="transactions.summary.recent"
        :loading="transactions.loading"
        empty-label="Aucune transaction — commencez par en ajouter une."
      />
    </div>

    <!-- Zone libre : à définir -->
    <div class="home__placeholder">
      <BaseText size="xs" color="muted">D'autres blocs viendront ici.</BaseText>
    </div>
  </section>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 42rem;
  margin: 0 auto;
  width: 100%;
}

.home__error {
  background: var(--color-danger-subtle);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}

.home__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.home__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.home__link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-primary);
}

.home__placeholder {
  padding: var(--space-6);
  text-align: center;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
}
</style>
