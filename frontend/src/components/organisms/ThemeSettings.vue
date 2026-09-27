<script setup>
/*
 * Réglage du thème (page Profil) : sombre, clair, ou celui de l'appareil — suivi en direct, voir
 * app.store. La bascule rapide soleil/lune reste sur les pages de connexion (ThemeToggle).
 */
import BaseChip from '@/components/atoms/BaseChip.vue'
import BaseIcon from '@/components/atoms/BaseIcon.vue'
import BaseText from '@/components/atoms/BaseText.vue'
import { useAppStore } from '@/stores/app.store.js'

const app = useAppStore()

const OPTIONS = [
  { value: 'dark',   label: 'Sombre',  icon: 'moon' },
  { value: 'light',  label: 'Clair',   icon: 'sun' },
  { value: 'system', label: 'Système', icon: 'monitor' },
]
</script>

<template>
  <section class="theme-settings" aria-labelledby="theme-settings-title">
    <BaseText id="theme-settings-title" as="h2" size="sm" weight="semibold" color="primary">Apparence</BaseText>

    <div class="theme-settings__options" role="group" aria-labelledby="theme-settings-title">
      <BaseChip
        v-for="option in OPTIONS"
        :key="option.value"
        shape="block"
        class="theme-settings__option"
        :active="app.preference === option.value"
        @click="app.setPreference(option.value)"
      >
        <BaseIcon :name="option.icon" :size="16" />
        {{ option.label }}
      </BaseChip>
    </div>

    <BaseText v-if="app.preference === 'system'" size="xs" color="muted">
      Suit le réglage de l'appareil — actuellement {{ app.isDark ? 'sombre' : 'clair' }}.
    </BaseText>
  </section>
</template>

<style scoped>
.theme-settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.theme-settings__options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-2);
}

.theme-settings__option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
}
</style>
