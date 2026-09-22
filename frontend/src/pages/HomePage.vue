<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import BaseText   from '@/components/atoms/BaseText.vue'
import BaseButton from '@/components/atoms/BaseButton.vue'
import BaseIcon   from '@/components/atoms/BaseIcon.vue'
import FabButton  from '@/components/atoms/FabButton.vue'
import AlertBanner      from '@/components/molecules/AlertBanner.vue'
import BalanceCard      from '@/components/molecules/BalanceCard.vue'
import BudgetList       from '@/components/molecules/BudgetList.vue'
import MonthNav         from '@/components/molecules/MonthNav.vue'
import TimeseriesChart  from '@/components/molecules/TimeseriesChart.vue'
import UpcomingList     from '@/components/molecules/UpcomingList.vue'
import FormModal        from '@/components/organisms/FormModal.vue'
import TransactionForm  from '@/components/organisms/TransactionForm.vue'
import TransactionList  from '@/components/organisms/TransactionList.vue'
import { useCategoriesStore }   from '@/stores/categories.store.js'
import { useEnvelopesStore }    from '@/stores/envelopes.store.js'
import { useRecurringStore }    from '@/stores/recurring.store.js'
import { useStatsStore }        from '@/stores/stats.store.js'
import { useTransactionsStore } from '@/stores/transactions.store.js'
import { buildBudgets, buildEnvelopes } from '@/utils/budget.js'
import { formatAmount }  from '@/utils/format.js'
import { monthRange }    from '@/utils/period.js'

const transactions = useTransactionsStore()
const categories   = useCategoriesStore()
const envelopes    = useEnvelopesStore()
const recurring    = useRecurringStore()
const stats        = useStatsStore()

/** Mois affiché : null tant qu'on n'a rien choisi (l'API répond alors avec le mois courant). */
const selectedMonth = ref(null)
const month = computed(() => selectedMonth.value ?? transactions.summary.month)

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

/** Recharge tout ce qui dépend du mois affiché. Les statistiques sont un bonus : leur échec ne se voit pas. */
async function refresh() {
  await transactions.fetchSummary({ month: selectedMonth.value ?? '' }).catch(() => {})

  if (transactions.summary.month) {
    const { from, to } = monthRange(transactions.summary.month)
    stats.fetch({ from, to, type: 'expense' }).catch(() => {})
  }
}

function onSaved() {
  refresh()
  closeModal()
}

watch(selectedMonth, refresh)

// ── Budgets, enveloppes, courbe du mois, prochaines échéances ──────────────
const budgets       = computed(() => buildBudgets(categories.items, stats.data.categories))
const envelopeList  = computed(() => buildEnvelopes(envelopes.items, stats.data.categories))

/** Ce qu'on a alloué aux enveloppes ce mois-ci dépasse-t-il ce qu'on a réellement encaissé ? */
const allocatedTotal = computed(() => envelopeList.value.reduce((total, e) => total + e.budget, 0))
const overAllocated  = computed(() =>
  envelopeList.value.length > 0 && allocatedTotal.value > transactions.summary.monthIncome,
)

/** Compte vide : on invite à commencer ; sinon, le mois affiché n'a simplement rien. */
const emptyLabel = computed(() =>
  transactions.summary.count === 0
    ? 'Aucune transaction — commencez par en ajouter une.'
    : 'Aucune transaction ce mois-ci.',
)

const hasMonthSpending = computed(() => !stats.loading && stats.data.total > 0)

/** Les 3 prochaines échéances, indépendamment du mois affiché. */
const upcoming = computed(() =>
  recurring.active
    .filter((item) => item.nextDate)
    .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
    .slice(0, 3),
)

onMounted(() => {
  refresh()
  categories.fetchAll().catch(() => {})
  envelopes.fetchAll().catch(() => {})
  recurring.fetchAll().catch(() => {})
})
</script>

<template>
  <section class="home">
    <!-- Solde global, puis le mois affiché -->
    <BalanceCard
      :balance="transactions.summary.balance"
      :month-income="transactions.summary.monthIncome"
      :month-expense="transactions.summary.monthExpense"
    >
      <template #month>
        <MonthNav
          v-if="month"
          :model-value="month"
          :min="transactions.summary.firstMonth ?? ''"
          :max="transactions.summary.currentMonth"
          @update:model-value="selectedMonth = $event"
        />
      </template>
    </BalanceCard>

    <AlertBanner v-if="transactions.error">{{ transactions.error }}</AlertBanner>

    <!-- Ajout : bouton flottant sur mobile, bouton pleine largeur sur ordinateur -->
    <BaseButton class="home__add" variant="primary" full @click="openCreate">
      <BaseIcon name="plus" :size="18" />
      Ajouter une transaction
    </BaseButton>

    <!-- Budgets : seulement si au moins une catégorie en a un -->
    <section v-if="budgets.length" class="home__section" aria-labelledby="home-budgets">
      <BaseText id="home-budgets" as="h2" size="lg" weight="semibold" color="primary">Budgets</BaseText>
      <div class="home__card"><BudgetList :budgets="budgets" /></div>
    </section>

    <!-- Enveloppes : seulement si au moins une a été créée -->
    <section v-if="envelopeList.length" class="home__section" aria-labelledby="home-envelopes">
      <BaseText id="home-envelopes" as="h2" size="lg" weight="semibold" color="primary">Enveloppes</BaseText>
      <AlertBanner v-if="overAllocated">
        Vous allouez {{ formatAmount(allocatedTotal) }} à vos enveloppes ce mois-ci, pour
        {{ formatAmount(transactions.summary.monthIncome) }} de revenus encaissés — libre à vous de
        continuer, mais l'enveloppe n'est alors plus financée par une vraie rentrée d'argent.
      </AlertBanner>
      <div class="home__card"><BudgetList :budgets="envelopeList" /></div>
    </section>

    <!-- Courbe des dépenses du mois -->
    <section v-if="hasMonthSpending" class="home__section" aria-labelledby="home-chart">
      <BaseText id="home-chart" as="h2" size="lg" weight="semibold" color="primary">Dépenses du mois</BaseText>
      <div class="home__card"><TimeseriesChart :timeseries="stats.data.timeseries" type="expense" /></div>
    </section>

    <!-- Prochaines charges fixes -->
    <section v-if="upcoming.length" class="home__section" aria-labelledby="home-upcoming">
      <div class="home__section-head">
        <BaseText id="home-upcoming" as="h2" size="lg" weight="semibold" color="primary">Prochaines échéances</BaseText>
        <RouterLink to="/recurring" class="home__link">
          <BaseText size="sm" color="brand" weight="medium">Tout voir</BaseText>
          <BaseIcon name="chevron" :size="16" />
        </RouterLink>
      </div>
      <div class="home__card"><UpcomingList :items="upcoming" /></div>
    </section>

    <!-- Dernières transactions du mois -->
    <section class="home__section" aria-labelledby="home-recent">
      <div class="home__section-head">
        <BaseText id="home-recent" as="h2" size="lg" weight="semibold" color="primary">
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
        clickable
        :empty-label="emptyLabel"
        @select="openEdit"
      />
    </section>

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
.home {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 42rem;
  margin: 0 auto;
  width: 100%;
}

.home__add { display: none; }

@media (min-width: 1024px) {
  .home__add { display: inline-flex; }
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

.home__card {
  padding: var(--space-4);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.home__link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  color: var(--color-primary);
}
</style>
