<script setup>
import { onMounted, ref } from 'vue'
import BaseButton    from '@/components/atoms/BaseButton.vue'
import BaseIcon      from '@/components/atoms/BaseIcon.vue'
import BaseText      from '@/components/atoms/BaseText.vue'
import FabButton     from '@/components/atoms/FabButton.vue'
import AlertBanner   from '@/components/molecules/AlertBanner.vue'
import ConfirmDialog from '@/components/molecules/ConfirmDialog.vue'
import EnvelopeRow    from '@/components/molecules/EnvelopeRow.vue'
import EnvelopeForm   from '@/components/organisms/EnvelopeForm.vue'
import FormModal      from '@/components/organisms/FormModal.vue'
import { useCategoriesStore } from '@/stores/categories.store.js'
import { useEnvelopesStore }  from '@/stores/envelopes.store.js'
import { useToastStore }      from '@/stores/toast.store.js'

const categories = useCategoriesStore()
const envelopes  = useEnvelopesStore()
const toasts     = useToastStore()

/** Modale de saisie : ouverte pour créer (`editing` null) ou pour modifier une enveloppe. */
const modalOpen = ref(false)
const editing   = ref(null)
const error     = ref('')

function openCreate() {
  editing.value   = null
  modalOpen.value = true
}

function openEdit(envelope) {
  editing.value   = envelope
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
  editing.value   = null
}

/** Noms des catégories liées, dans l'ordre de categoryIds — pour l'affichage en chips. */
function categoryNames(envelope) {
  return envelope.categoryIds
    .map((id) => categories.byId(id)?.name)
    .filter(Boolean)
}

// ── Suppression : confirmation simple, les catégories liées sont conservées ──
const pendingDelete = ref(null)
const deleteLoading  = ref(false)

function askRemove(envelope) {
  pendingDelete.value = envelope
  error.value = ''
}

function cancelRemove() {
  pendingDelete.value = null
}

async function confirmRemove() {
  if (!pendingDelete.value) return

  deleteLoading.value = true
  try {
    await envelopes.remove(pendingDelete.value.id)
    await categories.fetchAll({ force: true })
    toasts.success('Enveloppe supprimée.')
    if (editing.value?.id === pendingDelete.value.id) closeModal()
    pendingDelete.value = null
  } catch (err) {
    error.value = err.message
  } finally {
    deleteLoading.value = false
  }
}

async function onSaved() {
  await categories.fetchAll({ force: true })
  closeModal()
}

onMounted(() => {
  envelopes.fetchAll({ force: true }).catch(() => {})
  categories.fetchAll().catch(() => {})
})
</script>

<template>
  <section class="envelopes">
    <header class="envelopes__head">
      <RouterLink to="/profile" class="envelopes__back">
        <BaseText size="sm" color="muted">← Profil</BaseText>
      </RouterLink>

      <div class="envelopes__title">
        <div>
          <BaseText as="h1" size="2xl" weight="bold" color="primary">Enveloppes</BaseText>
          <BaseText as="p" size="sm" color="muted">
            Un plafond mensuel partagé entre plusieurs catégories.
          </BaseText>
        </div>

        <BaseButton class="envelopes__add" variant="primary" @click="openCreate">
          <BaseIcon name="plus" :size="18" />
          Ajouter
        </BaseButton>
      </div>
    </header>

    <AlertBanner v-if="error || envelopes.error">{{ error || envelopes.error }}</AlertBanner>

    <ul v-if="envelopes.items.length" class="envelopes__list">
      <EnvelopeRow
        v-for="envelope in envelopes.items"
        :key="envelope.id"
        :envelope="envelope"
        :category-names="categoryNames(envelope)"
        @edit="openEdit(envelope)"
        @remove="askRemove(envelope)"
      />
    </ul>

    <BaseText v-else-if="!envelopes.loading" as="p" size="sm" color="muted">
      Aucune enveloppe pour l'instant.
    </BaseText>

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
        Cette action est définitive. Les catégories liées sont conservées, simplement détachées.
      </BaseText>
    </ConfirmDialog>

    <FabButton label="Ajouter une enveloppe" @click="openCreate" />

    <FormModal
      v-if="modalOpen"
      :title="editing ? 'Modifier l\'enveloppe' : 'Nouvelle enveloppe'"
      @close="closeModal"
    >
      <EnvelopeForm :envelope="editing" @saved="onSaved" @cancel="closeModal" />
    </FormModal>
  </section>
</template>

<style scoped>
.envelopes {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 32rem;
  margin: 0 auto;
  width: 100%;
}

.envelopes__head {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.envelopes__back { align-self: flex-start; }

.envelopes__title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-3);
}

.envelopes__add { display: none; }

@media (min-width: 1024px) {
  .envelopes__add { display: inline-flex; }
}

.envelopes__list {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.envelopes__list :deep(li + li) { border-top: 1px solid var(--color-border); }
</style>
