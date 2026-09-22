<script setup>
import ThemeToggle from '@/components/organisms/ThemeToggle.vue'
import AuthBrand   from '@/components/molecules/AuthBrand.vue'

defineProps({
  subtitle: { type: String, default: '' },
})
</script>

<template>
  <div class="auth-page">
    <div class="auth-page__theme">
      <ThemeToggle />
    </div>

    <div class="auth-page__card">
      <AuthBrand :subtitle="subtitle" />

      <slot />

      <p v-if="$slots.footer" class="auth-page__footer">
        <slot name="footer" />
      </p>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  position: relative;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-5) var(--content-padding);
  background: var(--color-bg-base);
}

.auth-page__theme {
  position: absolute;
  top: var(--space-4);
  right: var(--content-padding);
}

.auth-page__card {
  width: 100%;
  max-width: 26rem;
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.auth-page__footer {
  text-align: center;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.auth-page__footer :slotted(a) {
  /* Couleur secondaire (menthe) : on la distingue de l'action principale, en bleu */
  color: var(--color-accent);
  font-weight: var(--font-semibold);
  text-decoration: none;
}

.auth-page__footer :slotted(a:hover) {
  color: var(--color-accent-hover);
  text-decoration: underline;
}
</style>
