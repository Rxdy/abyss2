<script setup>
/*
 * Support : signaler un bug ou proposer une amélioration. Le message part par email ;
 * `?type=idea` ouvre directement le formulaire sur « amélioration ».
 */
import { useRoute } from 'vue-router'
import BaseText    from '@/components/atoms/BaseText.vue'
import SupportForm from '@/components/organisms/SupportForm.vue'

const route = useRoute()
</script>

<template>
  <section class="support">
    <header class="support__head">
      <RouterLink to="/profile" class="support__back">
        <BaseText size="sm" color="muted">← Profil</BaseText>
      </RouterLink>
      <BaseText as="h1" size="2xl" weight="bold" color="primary">Support</BaseText>
      <BaseText as="p" size="sm" color="muted">
        Un bug, une idée ? Écrivez-nous : la réponse arrivera sur l'adresse email de votre compte.
      </BaseText>
    </header>

    <SupportForm class="support__section" :kind="route.query.type === 'idea' ? 'idea' : 'bug'" />
  </section>
</template>

<style scoped>
.support {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 32rem;
  margin: 0 auto;
  width: 100%;
}

.support__head {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.support__back { align-self: flex-start; }

.support__section {
  padding: var(--space-4);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}
</style>
