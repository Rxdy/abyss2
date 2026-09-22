<script setup>
/*
 * Formulaire de création / modification d'une catégorie, prévu pour vivre dans
 * une modale (FormModal). `category` : la catégorie à modifier, ou null pour
 * en créer une. `saved` / `cancel` préviennent le parent, qui ferme la modale.
 */
import { computed, ref } from 'vue'
import BaseButton   from '@/components/atoms/BaseButton.vue'
import BaseInput    from '@/components/atoms/BaseInput.vue'
import BaseSelect   from '@/components/atoms/BaseSelect.vue'
import AlertBanner  from '@/components/molecules/AlertBanner.vue'
import ColorPicker  from '@/components/molecules/ColorPicker.vue'
import { useDirtyForm }        from '@/composables/useDirtyForm.js'
import { useCategoriesStore } from '@/stores/categories.store.js'
import { useToastStore }      from '@/stores/toast.store.js'
import { parseAmountToCents } from '@/utils/format.js'
import { CATEGORY_COLORS }    from '@/utils/palette.js'

const props = defineProps({
  category: { type: Object, default: null },
})

const emit = defineEmits(['saved', 'cancel'])

const categories = useCategoriesStore()
const toasts     = useToastStore()

function initialForm() {
  return {
    id:       props.category?.id ?? null,
    name:     props.category?.name ?? '',
    color:    props.category?.color ?? CATEGORY_COLORS[0],
    parentId: props.category?.parentId ?? null,
    budget:   props.category?.budget ? String(props.category.budget / 100).replace('.', ',') : '',
  }
}

const form    = ref(initialForm())
const error   = ref('')
const budgetError = ref('')
const loading = ref(false)

useDirtyForm(form)

/** Catégories pouvant servir de parente : premier niveau, hors soi-même. */
const parentOptions = computed(() =>
  categories.topLevel.filter((category) => category.id !== form.value.id),
)

async function submit() {
  if (!form.value.name.trim()) {
    error.value = 'Le nom est requis.'
    return
  }

  // Budget facultatif : vide = aucun (null retire un budget existant).
  const budget = form.value.budget.trim() === '' ? null : parseAmountToCents(form.value.budget)
  if (form.value.budget.trim() !== '' && budget === null) {
    budgetError.value = 'Montant invalide (ex : 400).'
    return
  }

  loading.value = true
  error.value = ''
  budgetError.value = ''
  try {
    const payload = {
      name: form.value.name.trim(),
      color: form.value.color,
      parentId: form.value.parentId || null,
      budget,
    }
    const isEdit = Boolean(form.value.id)
    isEdit
      ? await categories.update(form.value.id, payload)
      : await categories.create(payload)
    toasts.success(isEdit ? 'Catégorie modifiée.' : 'Catégorie ajoutée.')
    emit('saved')
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <form class="category-form" novalidate @submit.prevent="submit">
    <AlertBanner v-if="error">{{ error }}</AlertBanner>

    <BaseInput
      v-model="form.name"
      id="category-name"
      label="Nom"
      placeholder="Alimentation, Transport…"
      required
    />

    <BaseSelect
      :model-value="form.parentId ?? ''"
      id="category-parent"
      label="Catégorie parente"
      :hint="form.id && categories.byId(form.id)?.childrenCount
        ? 'Cette catégorie a des sous-catégories : elle ne peut pas devenir elle-même une sous-catégorie.'
        : ''"
      @update:model-value="form.parentId = $event || null"
    >
      <option value="">Aucune</option>
      <option v-for="option in parentOptions" :key="option.id" :value="option.id">
        {{ option.name }}
      </option>
    </BaseSelect>

    <BaseInput
      v-model="form.budget"
      id="category-budget"
      label="Budget mensuel (€, optionnel)"
      placeholder="400"
      inputmode="decimal"
      hint="Plafond de dépenses par mois : une jauge apparaît sur l'accueil."
      :error="budgetError"
    />

    <ColorPicker v-model="form.color" />

    <div class="category-form__actions">
      <BaseButton type="submit" variant="primary" :loading="loading" full>
        {{ form.id ? 'Enregistrer' : 'Ajouter' }}
      </BaseButton>
      <BaseButton type="button" variant="ghost" full @click="emit('cancel')">
        Annuler
      </BaseButton>
    </div>
  </form>
</template>

<style scoped>
.category-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.category-form__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
