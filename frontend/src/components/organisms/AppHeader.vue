<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store.js'
import BaseText    from '@/components/atoms/BaseText.vue'
import BaseIcon    from '@/components/atoms/BaseIcon.vue'
import ThemeToggle from '@/components/molecules/ThemeToggle.vue'
import AppNavbar   from '@/components/organisms/AppNavbar.vue'

const router = useRouter()
const auth   = useAuthStore()

function logout() {
  auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <header class="app-header">
    <div class="app-header__left">
      <div class="app-header__brand">
        <svg class="app-header__logo" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" stroke-width="4" />
          <circle cx="32" cy="32" r="12" fill="currentColor" opacity="0.85" />
        </svg>
        <BaseText size="lg" weight="bold" color="primary">ABYSS2</BaseText>
      </div>

      <!-- Barre basse sous 1024px, entrées du header au-delà -->
      <AppNavbar />
    </div>

    <div class="app-header__actions">
      <ThemeToggle />
      <button
        type="button"
        class="app-header__logout"
        aria-label="Se déconnecter"
        @click="logout"
      >
        <BaseIcon name="logout" :size="18" />
      </button>
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
  width: 26px;
  height: 26px;
  color: var(--color-primary);
  flex-shrink: 0;
}

.app-header__actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.app-header__logout {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--radius-full);
  border: 1px solid var(--color-border);
  background: var(--color-bg-surface);
  color: var(--color-text-secondary);
  transition: color var(--transition-fast), border-color var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}

.app-header__logout:hover {
  color: var(--color-danger);
  border-color: var(--color-danger);
}
</style>
