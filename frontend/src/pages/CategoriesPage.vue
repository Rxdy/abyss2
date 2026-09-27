<script setup>
import { computed, onMounted, ref } from 'vue'
import BaseButton    from '@/components/atoms/BaseButton.vue'
import BaseIcon      from '@/components/atoms/BaseIcon.vue'
import BaseText      from '@/components/atoms/BaseText.vue'
import FabButton     from '@/components/atoms/FabButton.vue'
import BaseSelect    from '@/components/atoms/BaseSelect.vue'
import AlertBanner   from '@/components/molecules/AlertBanner.vue'
import CategoryRow   from '@/components/molecules/CategoryRow.vue'
import ConfirmDialog from '@/components/molecules/ConfirmDialog.vue'
import CategoryForm  from '@/components/organisms/CategoryForm.vue'
import FormModal     from '@/components/organisms/FormModal.vue'
import { useCategoriesStore } from '@/stores/categories.store.js'
import { useToastStore }      from '@/stores/toast.store.js'

const categories = useCategoriesStore()
const toasts     = useToastStore()

/** Modale de saisie : ouverte pour créer (`editing` null) ou pour modifier une catégorie. */
const modalOpen = ref(false)
const editing   = ref(null)
const error     = ref('')

function openCreate() {
  editing.value   = null
  modalOpen.value = true
}

function openEdit(category) {
  editing.value   = category
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  editing.value   = null
}

/** Vue en arbre : catégories de premier niveau, chacune suivie de ses enfants. */
const tree = computed(() =>
  categories.topLevel.map((category) => ({
    category,
    children: categories.childrenOf(category.id),
  })),
)

const moving = ref(false)

/**
 * Déplace une catégorie d'un cran vers le haut ou le bas, parmi ses
 * frères : les catégories de premier niveau entre elles, ou les
 * sous-catégories d'un même parent entre elles.
 */
async function move(category, direction) {
  const siblings = category.parentId ? categories.childrenOf(category.parentId) : categories.topLevel
  const index = siblings.findIndex((c) => c.id === category.id)
  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= siblings.length) return

  const reordered = [...siblings]
  ;[reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]]

  moving.value = true
  error.value = ''
  try {
    await categories.reorder(reordered)
  } catch (err) {
    error.value = err.message
  } finally {
    moving.value = false
  }
}

// ── Suppression : confirmation + option de recatégorisation ──────────────
const pendingDelete = ref(null) // catégorie ciblée par la suppression
const reassignTo    = ref('')
const deleteLoading  = ref(false)

/** Catégories proposées pour recevoir les transactions de la catégorie supprimée. */
const reassignOptions = computed(() => {
  if (!pendingDelete.value) return []
  return categories.items.filter((category) => category.id !== pendingDelete.value.id)
})

function askRemove(category) {
  pendingDelete.value = category
  reassignTo.value = ''
  error.value = ''
}

function cancelRemove() {
  pendingDelete.value = null
}

async function confirmRemove() {
  if (!pendingDelete.value) return

  deleteLoading.value = true
  try {
    await categories.remove(pendingDelete.value.id, { reassignTo: reassignTo.value || null })
    toasts.success('Catégorie supprimée.')
    if (editing.value?.id === pendingDelete.value.id) closeModal()
    pendingDelete.value = null
  } catch (err) {
    error.value = err.message
  } finally {
    deleteLoading.value = false
  }
}

onMounted(() => categories.fetchAll({ force: true }).catch(() => {}))
</script>

<template>
  <section class="categories">
    <header class="categories__head">
      <RouterLink to="/profile" class="categories__back">
        <BaseText size="sm" color="muted">← Profil</BaseText>
      </RouterLink>

      <div class="categories__title">
        <div>
          <BaseText as="h1" size="2xl" weight="bold" color="primary">Catégories</BaseText>
          <BaseText as="p" size="sm" color="muted">Elles servent à classer vos transactions.</BaseText>
        </div>

        <BaseButton class="categories__add" variant="primary" @click="openCreate">
          <BaseIcon name="plus" :size="18" />
          Ajouter
        </BaseButton>
      </div>
    </header>

    <AlertBanner v-if="error || categories.error">{{ error || categories.error }}</AlertBanner>

    <!-- Liste -->
    <ul v-if="categories.items.length" class="categories__list">
      <template v-for="(node, index) in tree" :key="node.category.id">
        <CategoryRow
          :category="node.category"
          :first="index === 0"
          :last="index === tree.length - 1"
          :busy="moving"
          @move="move(node.category, $event)"
          @edit="openEdit(node.category)"
          @remove="askRemove(node.category)"
        />

        <CategoryRow
          v-for="(child, childIndex) in node.children"
          :key="child.id"
          :category="child"
          child
          :first="childIndex === 0"
          :last="childIndex === node.children.length - 1"
          :busy="moving"
          @move="move(child, $event)"
          @edit="openEdit(child)"
          @remove="askRemove(child)"
        />
      </template>
    </ul>

    <BaseText v-else-if="!categories.loading" as="p" size="sm" color="muted">
      Aucune catégorie pour l'instant.
    </BaseText>

    <!-- Confirmation de suppression -->
    <ConfirmDialog
      v-if="pendingDelete"
      :title="`Supprimer « ${pendingDelete.name} » ?`"
      confirm-label="Supprimer"
      danger
      :loading="deleteLoading"
      @cancel="cancelRemove"
      @confirm="confirmRemove"
    >
      <BaseText size="sm" color="secondary">
        Cette action est définitive. La catégorie sera supprimée, mais les
        transactions qui l'utilisaient sont conservées.
      </BaseText>

      <BaseText v-if="pendingDelete.transactionCount" size="sm" color="danger" weight="semibold">
        {{ pendingDelete.transactionCount }}
        transaction{{ pendingDelete.transactionCount > 1 ? 's' : '' }}
        {{ pendingDelete.transactionCount > 1 ? 'seront' : 'sera' }}
        {{ reassignTo ? 're catégorisée' + (pendingDelete.transactionCount > 1 ? 's' : '') : 'sans catégorie' }}.
      </BaseText>

      <BaseText v-if="pendingDelete.childrenCount" size="sm" color="secondary">
        {{ pendingDelete.childrenCount }}
        sous-catégorie{{ pendingDelete.childrenCount > 1 ? 's' : '' }}
        {{ pendingDelete.childrenCount > 1 ? 'deviendront' : 'deviendra' }}
        {{ pendingDelete.childrenCount > 1 ? 'des catégories' : 'une catégorie' }} principale{{ pendingDelete.childrenCount > 1 ? 's' : '' }}.
      </BaseText>

      <BaseSelect
        v-if="pendingDelete.transactionCount"
        v-model="reassignTo"
        id="reassign-to"
        label="Recatégoriser ces transactions vers"
      >
        <option value="">Aucune catégorie (laisser sans catégorie)</option>
        <option v-for="option in reassignOptions" :key="option.id" :value="option.id">
          {{ option.name }}
        </option>
      </BaseSelect>
    </ConfirmDialog>

    <FabButton label="Ajouter une catégorie" @click="openCreate" />

    <FormModal
      v-if="modalOpen"
      :title="editing ? 'Modifier la catégorie' : 'Nouvelle catégorie'"
      @close="closeModal"
    >
      <CategoryForm :category="editing" @saved="closeModal" @cancel="closeModal" />
    </FormModal>
  </section>
</template>

<style scoped>
.categories {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 32rem;
  margin: 0 auto;
  width: 100%;
}

.categories__head {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.categories__back { align-self: flex-start; }

.categories__title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

/* Mobile : l'ajout passe par le bouton flottant ; « Ajouter » ne sert qu'à partir de 1024 px. */
.categories__add { display: none; }

@media (min-width: 1024px) {
  .categories__add { display: inline-flex; }
}

.categories__list {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.categories__list :deep(li + li) { border-top: 1px solid var(--color-border); }
</style>
