<script setup>
import { useAppStore } from '@/stores/app.store.js'
import BaseIcon   from '@/components/atoms/BaseIcon.vue'
import IconButton from '@/components/atoms/IconButton.vue'

const app = useAppStore()
</script>

<template>
  <IconButton
    class="theme-toggle"
    variant="outline"
    :label="app.isDark ? 'Passer en thème clair' : 'Passer en thème sombre'"
    :aria-pressed="app.isLight"
    @click="app.toggleTheme()"
  >
    <!-- Soleil en thème sombre (cliquer → clair), lune en thème clair (cliquer → sombre) -->
    <BaseIcon :name="app.isDark ? 'sun' : 'moon'" :size="18" />
  </IconButton>
</template>
