<script setup>
/*
 * Ligne de la liste des charges fixes : libellé, échéance, montant, et les
 * actions pause / modifier / supprimer. Une charge en pause est estompée.
 */
import BaseIcon   from '@/components/atoms/BaseIcon.vue'
import BaseText   from '@/components/atoms/BaseText.vue'
import IconButton from '@/components/atoms/IconButton.vue'
import { formatDate, formatSignedAmount } from '@/utils/format.js'

defineProps({
  item: { type: Object, required: true },
})

defineEmits(['toggle', 'edit', 'remove'])
</script>

<template>
  <li class="item" :class="{ 'item--paused': !item.active }">
    <span
      class="item__color"
      :style="{ background: item.category?.color ?? 'var(--color-text-muted)' }"
      aria-hidden="true"
    />

    <div class="item__body">
      <BaseText size="sm" weight="medium" color="primary" truncate>{{ item.title }}</BaseText>
      <BaseText size="xs" color="muted">
        Le {{ item.dayOfMonth }} de chaque mois
        <template v-if="item.category"> · {{ item.category.name }}</template>
        <template v-if="!item.active"> · en pause</template>
        <template v-else-if="item.nextDate"> · prochaine le {{ formatDate(item.nextDate) }}</template>
        <template v-else> · terminée</template>
      </BaseText>
    </div>

    <BaseText
      size="sm"
      weight="semibold"
      :color="item.type === 'expense' ? 'danger' : 'success'"
      class="item__amount"
    >
      {{ formatSignedAmount(item.amount, item.type) }}
    </BaseText>

    <IconButton
      :label="item.active ? `Mettre en pause ${item.title}` : `Reprendre ${item.title}`"
      @click="$emit('toggle')"
    >
      <BaseIcon :name="item.active ? 'pause' : 'play'" :size="16" />
    </IconButton>
    <IconButton :label="`Modifier ${item.title}`" @click="$emit('edit')">
      <BaseIcon name="pencil" :size="16" />
    </IconButton>
    <IconButton danger :label="`Supprimer ${item.title}`" @click="$emit('remove')">
      <BaseIcon name="trash" :size="16" />
    </IconButton>
  </li>
</template>

<style scoped>
.item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
}

.item--paused { opacity: 0.55; }

.item__color {
  width: 10px;
  height: 10px;
  border-radius: var(--radius-full);
  flex-shrink: 0;
}

.item__body { flex: 1; min-width: 0; }
.item__amount { font-variant-numeric: tabular-nums; white-space: nowrap; }
</style>
