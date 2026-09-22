<script setup>
/*
 * Ligne de la liste des enveloppes : nom, montant alloué, catégories liées
 * (chips), modification, suppression.
 */
import BaseIcon   from '@/components/atoms/BaseIcon.vue'
import BaseText   from '@/components/atoms/BaseText.vue'
import IconButton from '@/components/atoms/IconButton.vue'
import { formatAmount } from '@/utils/format.js'

defineProps({
  envelope:       { type: Object, required: true }, // { id, name, budget, categoryIds }
  categoryNames:  { type: Array, default: () => [] }, // noms des catégories liées, dans l'ordre de categoryIds
})

defineEmits(['edit', 'remove'])
</script>

<template>
  <li class="envelope">
    <div class="envelope__main">
      <BaseText size="sm" color="primary" weight="medium" truncate>{{ envelope.name }}</BaseText>
      <BaseText size="xs" color="muted">{{ formatAmount(envelope.budget) }} / mois</BaseText>

      <div v-if="categoryNames.length" class="envelope__categories">
        <span v-for="name in categoryNames" :key="name" class="envelope__category">{{ name }}</span>
      </div>
      <BaseText v-else size="xs" color="muted">Aucune catégorie liée.</BaseText>
    </div>

    <IconButton :label="`Modifier ${envelope.name}`" @click="$emit('edit')">
      <BaseIcon name="pencil" :size="16" />
    </IconButton>
    <IconButton danger :label="`Supprimer ${envelope.name}`" @click="$emit('remove')">
      <BaseIcon name="trash" :size="16" />
    </IconButton>
  </li>
</template>

<style scoped>
.envelope {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
}

.envelope__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.envelope__categories {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.envelope__category {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-full);
  padding: 0.125rem var(--space-2);
}
</style>
