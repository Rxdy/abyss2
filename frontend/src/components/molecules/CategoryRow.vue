<script setup>
/*
 * Ligne de la liste des catégories : pastille, nom, réordonnancement,
 * modification, suppression. `child` : sous-catégorie, en retrait.
 */
import BaseIcon   from '@/components/atoms/BaseIcon.vue'
import BaseText   from '@/components/atoms/BaseText.vue'
import IconButton from '@/components/atoms/IconButton.vue'
import { formatAmount } from '@/utils/format.js'

defineProps({
  category: { type: Object, required: true }, // { id, name, color, budget? }
  child:    { type: Boolean, default: false },
  first:    { type: Boolean, default: false }, // premier parmi ses frères → « Monter » désactivé
  last:     { type: Boolean, default: false },
  /** Un réordonnancement est en cours : on bloque les flèches. */
  busy:     { type: Boolean, default: false },
})

defineEmits(['move', 'edit', 'remove'])
</script>

<template>
  <li class="category" :class="{ 'category--child': child }">
    <span class="category__color" :style="{ background: category.color ?? 'var(--color-text-muted)' }" aria-hidden="true" />
    <div class="category__name">
      <BaseText size="sm" color="primary" truncate>{{ category.name }}</BaseText>
      <BaseText v-if="category.budget" size="xs" color="muted">Budget {{ formatAmount(category.budget) }} / mois</BaseText>
    </div>

    <div class="category__move">
      <IconButton :disabled="busy || first" :label="`Monter ${category.name}`" @click="$emit('move', 'up')">
        <BaseIcon name="chevron" :size="14" class="category__move-icon category__move-icon--up" />
      </IconButton>
      <IconButton :disabled="busy || last" :label="`Descendre ${category.name}`" @click="$emit('move', 'down')">
        <BaseIcon name="chevron" :size="14" class="category__move-icon category__move-icon--down" />
      </IconButton>
    </div>

    <IconButton :label="`Modifier ${category.name}`" @click="$emit('edit')">
      <BaseIcon name="pencil" :size="16" />
    </IconButton>
    <IconButton danger :label="`Supprimer ${category.name}`" @click="$emit('remove')">
      <BaseIcon name="trash" :size="16" />
    </IconButton>
  </li>
</template>

<style scoped>
.category {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
}

.category--child { padding-left: var(--space-8); }

.category__color {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.category__name {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.category__move {
  display: flex;
  flex-direction: column;
}

.category__move-icon--up   { transform: rotate(-90deg); }
.category__move-icon--down { transform: rotate(90deg); }
</style>
