<script setup>
import AppLogo  from '@/components/atoms/AppLogo.vue'
import BaseText from '@/components/atoms/BaseText.vue'

defineProps({
  subtitle: { type: String, default: '' },
})
</script>

<template>
  <div class="brand">
    <AppLogo class="brand__logo" :size="96" />
    <BaseText as="h1" size="3xl" weight="bold" color="primary">ABYSS2</BaseText>
    <BaseText v-if="subtitle" as="p" size="sm" color="muted">{{ subtitle }}</BaseText>
  </div>
</template>

<style scoped>
.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  text-align: center;
}

.brand__logo {
  /* pas de carte ici : le logo est posé directement sur le fond de page */
  --logo-gap: var(--color-bg-base);
  filter: drop-shadow(var(--shadow-glow-primary));
}
</style>
