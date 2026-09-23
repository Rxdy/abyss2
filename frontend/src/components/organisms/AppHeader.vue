<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store.js'
import BaseText    from '@/components/atoms/BaseText.vue'
import BaseIcon    from '@/components/atoms/BaseIcon.vue'
import IconButton  from '@/components/atoms/IconButton.vue'
import AppLogo     from '@/components/atoms/AppLogo.vue'
import ThemeToggle from '@/components/organisms/ThemeToggle.vue'
import PwaInstallButton from '@/components/organisms/PwaInstallButton.vue'
import AppNavbar   from '@/components/organisms/AppNavbar.vue'

const router = useRouter()
const auth   = useAuthStore()

async function logout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="app-header">
    <div class="app-header__left">
      <div class="app-header__brand">
        <AppLogo class="app-header__logo" :size="30" />
        <BaseText size="lg" weight="bold" color="primary">ABYSS2</BaseText>
      </div>

      <!-- Barre basse sous 1024px, entrées du header au-delà -->
      <AppNavbar />
    </div>

    <div class="app-header__actions">
      <PwaInstallButton />
      <ThemeToggle />
      <IconButton
        class="app-header__logout"
        variant="outline"
        danger
        label="Se déconnecter"
        @click="logout"
      >
        <BaseIcon name="logout" :size="18" />
      </IconButton>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  height: var(--header-height);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 0 var(--content-padding);
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
