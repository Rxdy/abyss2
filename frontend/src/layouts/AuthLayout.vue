<script setup>
/* Layout utilisé pour Login et Register — aucun chrome (pas de header/footer) */
</script>

<template>
  <div class="auth-layout">
    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </div>
</template>

<style scoped>
.auth-layout {
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
}
</style>
