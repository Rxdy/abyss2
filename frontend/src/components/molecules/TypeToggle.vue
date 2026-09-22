<script setup>
import BaseChip from '@/components/atoms/BaseChip.vue'

defineProps({
  /** 'expense' | 'income' */
  modelValue: { type: String, default: 'expense' },
  labels:     { type: Object, default: () => ({ expense: 'Dépense', income: 'Revenu' }) },
  ariaLabel:  { type: String, default: 'Type' },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <div class="type-toggle" role="group" :aria-label="ariaLabel">
    <BaseChip
      v-for="type in ['expense', 'income']"
      :key="type"
      shape="block"
      :active="modelValue === type"
      @click="$emit('update:modelValue', type)"
    >
      {{ labels[type] }}
    </BaseChip>
  </div>
</template>

<style scoped>
.type-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}
</style>
