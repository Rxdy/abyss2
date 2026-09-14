<script setup>
import BaseText from '@/components/atoms/BaseText.vue'
</script>

<template>
  <section class="not-found">
    <BaseText as="h1" size="3xl" weight="bold" color="primary">404</BaseText>
    <BaseText as="p" size="sm" color="muted">Cette page n'existe pas.</BaseText>
    <RouterLink to="/">
      <BaseText size="sm" color="brand" weight="medium">Retour à l'accueil</BaseText>
    </RouterLink>
  </section>
</template>

<style scoped>
.not-found {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  text-align: center;
  padding: var(--space-16) var(--space-4);
}
</style>
