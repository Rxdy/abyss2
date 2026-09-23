<script setup>
/* AppHeader porte aussi la navigation (barre basse sous 1024px). */
import AppHeader from '@/components/organisms/AppHeader.vue'
import OfflineBanner from '@/components/organisms/OfflineBanner.vue'
import UpdateBanner  from '@/components/organisms/UpdateBanner.vue'
</script>

<template>
  <div class="default-layout">
    <AppHeader />
    <OfflineBanner />
    <UpdateBanner />

    <main class="default-layout__main">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
  </div>
</template>

<style scoped>
.default-layout {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.default-layout__main {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--content-padding);
  /* Mobile + tablette : la navbar est fixée en bas, on réserve sa hauteur */
  padding-bottom: calc(var(--navbar-height) + var(--space-4) + env(safe-area-inset-bottom));
}

/* Une page avec bouton flottant : on réserve sa hauteur pour qu'il ne recouvre pas le dernier élément. */
.default-layout__main:has(.fab) {
  padding-bottom: calc(var(--navbar-height) + var(--space-4) + env(safe-area-inset-bottom) + 4.5rem);
}

@media (min-width: 1024px) {
  /* --navbar-height vaut 0 : la navigation est passée dans le header */
  .default-layout__main,
  .default-layout__main:has(.fab) { padding-bottom: var(--content-padding); }
}
</style>
