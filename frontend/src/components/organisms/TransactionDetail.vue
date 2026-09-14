<script setup>
import { onMounted, onBeforeUnmount } from 'vue'
import BaseText   from '@/components/atoms/BaseText.vue'
import BaseButton from '@/components/atoms/BaseButton.vue'
import { formatAmount, formatDate } from '@/utils/format.js'

const props = defineProps({
  transaction: { type: Object, required: true },
})

const emit = defineEmits(['edit', 'close'])

function onKeydown(event) {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div class="detail-overlay" role="presentation" @mousedown.self="emit('close')">
      <div class="detail" role="dialog" aria-modal="true" :aria-label="`Détail — ${transaction.title}`">
        <span
          class="detail__color"
          :style="{ background: transaction.category?.color ?? 'var(--color-text-muted)' }"
          aria-hidden="true"
        />

        <BaseText as="h2" size="lg" weight="semibold" color="primary">{{ transaction.title }}</BaseText>

        <BaseText
          as="p"
          size="2xl"
          weight="bold"
          :color="transaction.type === 'expense' ? 'danger' : 'success'"
          class="detail__amount"
        >
          {{ formatAmount(transaction.amount) }}
        </BaseText>

        <dl class="detail__rows">
          <div class="detail__row">
            <dt><BaseText size="sm" color="muted">Date</BaseText></dt>
            <dd><BaseText size="sm" color="primary">{{ formatDate(transaction.date) }}</BaseText></dd>
          </div>
          <div class="detail__row">
            <dt><BaseText size="sm" color="muted">Catégorie</BaseText></dt>
            <dd><BaseText size="sm" color="primary">{{ transaction.category?.name ?? 'Aucune' }}</BaseText></dd>
          </div>
          <div v-if="transaction.recurringId" class="detail__row">
            <dt><BaseText size="sm" color="muted">Origine</BaseText></dt>
            <dd><BaseText size="sm" color="primary">Charge fixe (générée automatiquement)</BaseText></dd>
          </div>
          <div v-if="transaction.note" class="detail__row detail__row--note">
            <dt><BaseText size="sm" color="muted">Note</BaseText></dt>
            <dd><BaseText size="sm" color="primary">{{ transaction.note }}</BaseText></dd>
          </div>
        </dl>

        <div class="detail__actions">
          <BaseButton type="button" variant="primary" full @click="emit('edit')">
            Modifier
          </BaseButton>
          <BaseButton type="button" variant="ghost" full @click="emit('close')">
            Fermer
          </BaseButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.detail-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  z-index: 100;
}

.detail {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  max-width: 26rem;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--space-5);
}

.detail__color {
  width: 2rem;
  height: 4px;
  border-radius: var(--radius-full);
}

.detail__amount { font-variant-numeric: tabular-nums; }

.detail__rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-border);
}

.detail__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.detail__row--note { flex-direction: column; align-items: flex-start; gap: var(--space-1); }

.detail__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
</style>
