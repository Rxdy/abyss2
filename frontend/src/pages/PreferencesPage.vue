<script setup>
/*
 * Préférences : thème (propre à cet appareil), devise, session et notifications (enregistrées sur
 * le compte).
 */
import BaseText from '@/components/atoms/BaseText.vue'
import ThemeSettings        from '@/components/organisms/ThemeSettings.vue'
import CurrencySettings     from '@/components/organisms/CurrencySettings.vue'
import NotificationSettings from '@/components/organisms/NotificationSettings.vue'
import SessionSettings      from '@/components/organisms/SessionSettings.vue'
</script>

<template>
  <section class="preferences">
    <header class="preferences__head">
      <RouterLink to="/profile" class="preferences__back">
        <BaseText size="sm" color="muted">← Profil</BaseText>
      </RouterLink>
      <BaseText as="h1" size="2xl" weight="bold" color="primary">Préférences</BaseText>
      <BaseText as="p" size="sm" color="muted">
        Le thème vaut pour cet appareil ; le reste suit votre compte.
      </BaseText>
    </header>

    <ThemeSettings class="preferences__section" />
    <CurrencySettings class="preferences__section" />
    <SessionSettings class="preferences__section" />
    <NotificationSettings class="preferences__section" />
  </section>
</template>

<style scoped>
.preferences {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 32rem;
  margin: 0 auto;
  width: 100%;
}

.preferences__head {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.preferences__back { align-self: flex-start; }

.preferences__section {
  padding: var(--space-4);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}
</style>
