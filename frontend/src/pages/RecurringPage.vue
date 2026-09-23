<script setup>
import { computed, onMounted, ref } from 'vue'
import BaseButton    from '@/components/atoms/BaseButton.vue'
import BaseIcon      from '@/components/atoms/BaseIcon.vue'
import BaseText      from '@/components/atoms/BaseText.vue'
import FabButton     from '@/components/atoms/FabButton.vue'
import ConfirmDialog from '@/components/molecules/ConfirmDialog.vue'
import AlertBanner   from '@/components/molecules/AlertBanner.vue'
import RecurringItem from '@/components/molecules/RecurringItem.vue'
import FormModal     from '@/components/organisms/FormModal.vue'
import RecurringForm from '@/components/organisms/RecurringForm.vue'
import { useRecurringStore }  from '@/stores/recurring.store.js'
import { useCategoriesStore } from '@/stores/categories.store.js'
import { useToastStore }      from '@/stores/toast.store.js'
import { formatSignedAmount } from '@/utils/format.js'

const recurring  = useRecurringStore()
const categories = useCategoriesStore()
const toasts     = useToastStore()

/** Modale de saisie : ouverte pour créer (`editing` null) ou pour modifier une charge. */
const modalOpen = ref(false)
const editing   = ref(null)
const error     = ref('')

function openCreate() {
  editing.value   = null
  modalOpen.value = true
}

function openEdit(item) {
  editing.value   = item
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  editing.value   = null
}

async function toggle(item) {
  error.value = ''
  try {
    await recurring.toggleActive(item)
    // `item` est l'état d'avant la bascule
    toasts.success(item.active ? 'Charge fixe mise en pause.' : 'Charge fixe réactivée.')
  } catch (err) {
    error.value = err.message
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
    toasts.success('Charge fixe supprimée.')
    if (editing.value?.id === pendingDelete.value.id) closeModal()
    pendingDelete.value = null
  } catch (err) {
    error.value = err.message
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
      <div>
        <BaseText as="h1" size="2xl" weight="bold" color="primary">Dépenses &amp; revenus fixes</BaseText>
        <BaseText as="p" size="sm" color="muted">
          Une transaction est créée automatiquement chaque mois, à l'échéance.
        </BaseText>
      </div>

      <BaseButton class="recurring__add" variant="primary" @click="openCreate">
        <BaseIcon name="plus" :size="18" />
        Ajouter
      </BaseButton>
    </header>

    <div v-if="recurring.items.length" class="recurring__summary">
      <BaseText size="xs" color="muted">Impact mensuel net (actifs)</BaseText>
      <BaseText size="xl" weight="bold" :color="netLabel">
        {{ formatSignedAmount(Math.abs(recurring.monthlyNet), recurring.monthlyNet < 0 ? 'expense' : 'income') }}
      </BaseText>
    </div>

    <AlertBanner v-if="error || recurring.error">{{ error || recurring.error }}</AlertBanner>

    <!-- Liste -->
    <ul v-if="recurring.items.length" class="recurring__list">
      <RecurringItem
        v-for="item in recurring.items"
        :key="item.id"
        :item="item"
        @toggle="toggle(item)"
        @edit="openEdit(item)"
        @remove="askRemove(item)"
      />
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

    <FabButton label="Ajouter une charge fixe" @click="openCreate" />

    <FormModal
      v-if="modalOpen"
      :title="editing ? 'Modifier la charge fixe' : 'Nouvelle charge fixe'"
      @close="closeModal"
    >
      <RecurringForm :item="editing" @saved="closeModal" @cancel="closeModal" />
    </FormModal>
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
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

/* Mobile : l'ajout passe par le bouton flottant ; « Ajouter » ne sert qu'à partir de 1024 px. */
.recurring__add { display: none; }

@media (min-width: 1024px) {
  .recurring__add { display: inline-flex; }
}

.recurring__summary {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4) var(--space-5);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.recurring__list {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.recurring__list :deep(li + li) { border-top: 1px solid var(--color-border); }
</style>
