<script setup>
import { computed, onMounted, ref } from 'vue'
import BaseText     from '@/components/atoms/BaseText.vue'
import BaseInput    from '@/components/atoms/BaseInput.vue'
import BaseButton   from '@/components/atoms/BaseButton.vue'
import BaseIcon     from '@/components/atoms/BaseIcon.vue'
import ConfirmDialog from '@/components/molecules/ConfirmDialog.vue'
import { useCategoriesStore } from '@/stores/categories.store.js'

const categories = useCategoriesStore()

const PALETTE = [
  '#4f8ef7', '#4ade80', '#facc15', '#f87171',
  '#a78bfa', '#38bdf8', '#2dd4bf', '#94a3b8',
]

const form    = ref({ id: null, name: '', color: PALETTE[0], parentId: null })
const error   = ref('')
const loading = ref(false)

/** Catégories pouvant servir de parente : premier niveau, hors soi-même. */
const parentOptions = computed(() =>
  categories.topLevel.filter((category) => category.id !== form.value.id),
)

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
  try {
    await categories.reorder(reordered)
  } catch (err) {
    error.value = err.message
  } finally {
    moving.value = false
  }
}

function reset() {
  form.value = { id: null, name: '', color: PALETTE[0], parentId: null }
  error.value = ''
}

function edit(category) {
  form.value = {
    id: category.id,
    name: category.name,
    color: category.color ?? PALETTE[0],
    parentId: category.parentId ?? null,
  }
  error.value = ''
}

async function submit() {
  if (!form.value.name.trim()) {
    error.value = 'Le nom est requis.'
    return
  }

  loading.value = true
  try {
    const payload = {
      name: form.value.name.trim(),
      color: form.value.color,
      parentId: form.value.parentId || null,
    }
    form.value.id
      ? await categories.update(form.value.id, payload)
      : await categories.create(payload)
    reset()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
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
    if (form.value.id === pendingDelete.value.id) reset()
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
      <BaseText as="h1" size="2xl" weight="bold" color="primary">Catégories</BaseText>
      <BaseText as="p" size="sm" color="muted">
        Elles servent à classer les transactions. Supprimer une catégorie ne
        supprime pas les transactions qui l'utilisaient.
      </BaseText>
    </header>

    <div v-if="error || categories.error" class="categories__error" role="alert">
      <BaseText size="sm" color="danger">{{ error || categories.error }}</BaseText>
    </div>

    <!-- Création / édition -->
    <form class="categories__form" novalidate @submit.prevent="submit">
      <BaseText as="h2" size="base" weight="semibold" color="primary">
        {{ form.id ? 'Modifier la catégorie' : 'Nouvelle catégorie' }}
      </BaseText>

      <BaseInput
        v-model="form.name"
        id="category-name"
        label="Nom"
        placeholder="Alimentation, Transport…"
        required
      />

      <div class="field">
        <label class="field__label" for="category-parent">Catégorie parente</label>
        <select id="category-parent" v-model="form.parentId" class="field__select">
          <option :value="null">Aucune</option>
          <option v-for="option in parentOptions" :key="option.id" :value="option.id">
            {{ option.name }}
          </option>
        </select>
        <p v-if="form.id && categories.byId(form.id)?.childrenCount" class="field__hint">
          Cette catégorie a des sous-catégories : elle ne peut pas devenir elle-même une sous-catégorie.
        </p>
      </div>

      <div class="field">
        <span class="field__label" id="color-label">Couleur</span>
        <div class="palette" role="group" aria-labelledby="color-label">
          <button
            v-for="color in PALETTE"
            :key="color"
            type="button"
            class="palette__swatch"
            :class="{ 'palette__swatch--active': form.color === color }"
            :style="{ background: color }"
            :aria-label="`Couleur ${color}`"
            :aria-pressed="form.color === color"
            @click="form.color = color"
          />

          <label class="palette__custom" :style="{ background: form.color }">
            <input
              type="color"
              class="palette__custom-input"
              :value="form.color"
              aria-label="Choisir une couleur personnalisée"
              @input="form.color = $event.target.value"
            />
            <BaseIcon name="plus" :size="14" />
          </label>
        </div>
      </div>

      <div class="categories__actions">
        <BaseButton type="submit" variant="primary" :loading="loading" full>
          {{ form.id ? 'Enregistrer' : 'Ajouter' }}
        </BaseButton>
        <BaseButton v-if="form.id" type="button" variant="ghost" full @click="reset">
          Annuler
        </BaseButton>
      </div>
    </form>

    <!-- Liste -->
    <ul v-if="categories.items.length" class="categories__list">
      <template v-for="(node, index) in tree" :key="node.category.id">
        <li class="category">
          <span class="category__color" :style="{ background: node.category.color ?? 'var(--color-text-muted)' }" aria-hidden="true" />
          <BaseText size="sm" color="primary" truncate class="category__name">
            {{ node.category.name }}
          </BaseText>

          <div class="category__move">
            <button type="button" class="category__action" :disabled="moving || index === 0" :aria-label="`Monter ${node.category.name}`" @click="move(node.category, 'up')">
              <BaseIcon name="chevron" :size="14" class="category__move-icon category__move-icon--up" />
            </button>
            <button type="button" class="category__action" :disabled="moving || index === tree.length - 1" :aria-label="`Descendre ${node.category.name}`" @click="move(node.category, 'down')">
              <BaseIcon name="chevron" :size="14" class="category__move-icon category__move-icon--down" />
            </button>
          </div>

          <button type="button" class="category__action" :aria-label="`Modifier ${node.category.name}`" @click="edit(node.category)">
            <BaseIcon name="tag" :size="16" />
          </button>
          <button type="button" class="category__action category__action--danger" :aria-label="`Supprimer ${node.category.name}`" @click="askRemove(node.category)">
            <BaseIcon name="logout" :size="16" />
          </button>
        </li>

        <li v-for="(child, childIndex) in node.children" :key="child.id" class="category category--child">
          <span class="category__color" :style="{ background: child.color ?? 'var(--color-text-muted)' }" aria-hidden="true" />
          <BaseText size="sm" color="primary" truncate class="category__name">
            {{ child.name }}
          </BaseText>

          <div class="category__move">
            <button type="button" class="category__action" :disabled="moving || childIndex === 0" :aria-label="`Monter ${child.name}`" @click="move(child, 'up')">
              <BaseIcon name="chevron" :size="14" class="category__move-icon category__move-icon--up" />
            </button>
            <button type="button" class="category__action" :disabled="moving || childIndex === node.children.length - 1" :aria-label="`Descendre ${child.name}`" @click="move(child, 'down')">
              <BaseIcon name="chevron" :size="14" class="category__move-icon category__move-icon--down" />
            </button>
          </div>

          <button type="button" class="category__action" :aria-label="`Modifier ${child.name}`" @click="edit(child)">
            <BaseIcon name="tag" :size="16" />
          </button>
          <button type="button" class="category__action category__action--danger" :aria-label="`Supprimer ${child.name}`" @click="askRemove(child)">
            <BaseIcon name="logout" :size="16" />
          </button>
        </li>
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

      <div v-if="pendingDelete.transactionCount" class="field">
        <label class="field__label" for="reassign-to">Recatégoriser ces transactions vers</label>
        <select id="reassign-to" v-model="reassignTo" class="field__select">
          <option value="">Aucune catégorie (laisser sans catégorie)</option>
          <option v-for="option in reassignOptions" :key="option.id" :value="option.id">
            {{ option.name }}
          </option>
        </select>
      </div>
    </ConfirmDialog>
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

.categories__error {
  background: var(--color-danger-subtle);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}

.categories__form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field__label {
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--color-text-secondary);
}

.field__hint {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.field__select {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-base);
  color: var(--color-text-primary);
  min-height: 2.75rem;
  width: 100%;
}

.field__select:focus {
  outline: none;
  border-color: var(--color-border-focus);
  box-shadow: 0 0 0 3px var(--color-primary-ring);
}

.palette {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.palette__swatch {
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-full);
  border: 2px solid transparent;
  transition: transform var(--transition-fast), border-color var(--transition-fast);
}

.palette__swatch--active {
  border-color: var(--color-text-primary);
  transform: scale(1.1);
}

.palette__custom {
  position: relative;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-full);
  border: 2px dashed var(--color-border);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-inverse);
  cursor: pointer;
  overflow: hidden;
}

.palette__custom-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  border: none;
  padding: 0;
}

.categories__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.categories__list {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.category {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
}

.category + .category { border-top: 1px solid var(--color-border); }

.category--child { padding-left: var(--space-8); }

.category__color {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.category__name { flex: 1; min-width: 0; }

.category__action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  transition: color var(--transition-fast), background var(--transition-fast);
}

.category__action:hover:not(:disabled) {
  color: var(--color-primary);
  background: var(--color-primary-subtle);
}

.category__action:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.category__action--danger:hover {
  color: var(--color-danger);
  background: var(--color-danger-subtle);
}

.category__move {
  display: flex;
  flex-direction: column;
}

.category__move .category__action {
  width: 1.5rem;
  height: 1.25rem;
}

.category__move-icon--up   { transform: rotate(-90deg); }
.category__move-icon--down { transform: rotate(90deg); }
</style>
