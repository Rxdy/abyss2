<script setup>
import BaseText from '@/components/atoms/BaseText.vue'

defineProps({
  /** 'danger' | 'success' | 'warning' */
  variant: { type: String, default: 'danger' },
})
</script>

<template>
  <div class="alert" :class="`alert--${variant}`" role="alert">
    <BaseText size="sm" :color="variant"><slot /></BaseText>
  </div>
</template>

<style scoped>
.alert {
  border: 1px solid;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}

.alert--danger  { background: var(--color-danger-subtle);  border-color: var(--color-danger); }
.alert--success { background: var(--color-success-subtle); border-color: var(--color-success); }
.alert--warning { background: var(--color-warning-subtle); border-color: var(--color-warning); }
</style>
