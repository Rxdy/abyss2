<script setup>
/* Pas de bouton de déconnexion ici : trop proche de la cloche des notifications, on s'y trompait.
   La déconnexion se fait depuis le Profil. */
import BaseText    from '@/components/atoms/BaseText.vue'
import AppLogo     from '@/components/atoms/AppLogo.vue'
import PwaInstallButton  from '@/components/organisms/PwaInstallButton.vue'
import NotificationBell  from '@/components/organisms/NotificationBell.vue'
import AppNavbar   from '@/components/organisms/AppNavbar.vue'
</script>

<template>
  <header class="app-header">
    <div class="app-header__left">
      <div class="app-header__brand">
        <AppLogo class="app-header__logo" :size="30" />
        <BaseText size="lg" weight="bold" color="primary">ABYSS</BaseText>
      </div>

      <!-- Barre basse sous 1024px, entrées du header au-delà -->
      <AppNavbar />
    </div>

    <div class="app-header__actions">
      <PwaInstallButton />
      <NotificationBell />
    </div>
  </header>
</template>

<style scoped>
/* La PWA iOS dessine sous la barre d'état (heure, batterie) : l'en-tête la réserve en haut, sur
   son propre fond. env(safe-area-inset-top) vaut 0 partout ailleurs. */
.app-header {
  height: calc(var(--header-height) + env(safe-area-inset-top));
  padding-top: env(safe-area-inset-top);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding-left: var(--content-padding);
  padding-right: var(--content-padding);
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border);
}

.app-header__left {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  min-width: 0;
}

.app-header__brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.app-header__logo {
  flex-shrink: 0;
}

.app-header__actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

</style>
