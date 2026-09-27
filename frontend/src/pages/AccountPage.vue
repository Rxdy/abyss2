<script setup>
/*
 * Gestion du compte : adresse email et mot de passe. Chaque changement redemande le mot de passe
 * actuel et déconnecte les autres appareils (voir PUT /api/user/email et /api/user/password).
 */
import { ref } from 'vue'
import BaseText from '@/components/atoms/BaseText.vue'
import EmailChangeForm    from '@/components/organisms/EmailChangeForm.vue'
import PasswordChangeForm from '@/components/organisms/PasswordChangeForm.vue'
import { useAuthStore } from '@/stores/auth.store.js'

const auth = useAuthStore()

// Changer de clé remonte le formulaire : il repart vide après un changement réussi.
const passwordFormKey = ref(0)
</script>

<template>
  <section class="account">
    <header class="account__head">
      <RouterLink to="/profile" class="account__back">
        <BaseText size="sm" color="muted">← Profil</BaseText>
      </RouterLink>
      <BaseText as="h1" size="2xl" weight="bold" color="primary">Gestion du compte</BaseText>
      <BaseText as="p" size="sm" color="muted">
        Chaque changement déconnecte vos autres appareils.
      </BaseText>
    </header>

    <section class="account__section" aria-labelledby="account-email-title">
      <BaseText id="account-email-title" as="h2" size="sm" weight="semibold" color="primary">Adresse email</BaseText>
      <BaseText size="sm" color="secondary">
        Actuelle : <strong>{{ auth.user?.email ?? '—' }}</strong>
      </BaseText>
      <EmailChangeForm />
    </section>

    <section class="account__section" aria-labelledby="account-password-title">
      <BaseText id="account-password-title" as="h2" size="sm" weight="semibold" color="primary">Mot de passe</BaseText>
      <PasswordChangeForm :key="passwordFormKey" :cancelable="false" @saved="passwordFormKey++" />
    </section>
  </section>
</template>

<style scoped>
.account {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  max-width: 32rem;
  margin: 0 auto;
  width: 100%;
}

.account__head {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.account__back { align-self: flex-start; }

.account__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}
</style>
