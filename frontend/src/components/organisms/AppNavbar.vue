<script setup>
/*
 * Navigation principale.
 *   < 1024px (mobile + tablette) : barre fixée en bas de l'écran, icônes seules
 *   ≥ 1024px (desktop)           : rentre dans le flux du header, icône + libellé
 *
 * Le composant est monté dans AppHeader : en dessous de 1024px il en sort
 * visuellement grâce à `position: fixed`.
 *
 * Ajouter une entrée ici suffit à la faire apparaître dans la navigation.
 */
import NavItem from '@/components/molecules/NavItem.vue'

/* L'accueil est volontairement au centre : c'est la destination par défaut. */
const ROUTES = [
  { to: '/transactions', icon: 'list', label: 'Transactions' },
  { to: '/',             icon: 'home', label: 'Accueil'      },
  { to: '/profile',      icon: 'user', label: 'Profil'       },
]
</script>

<template>
  <nav class="navbar" aria-label="Navigation principale">
    <NavItem
      v-for="route in ROUTES"
      :key="route.to"
      :to="route.to"
      :icon="route.icon"
      :label="route.label"
    />
  </nav>
</template>

<style scoped>
/* Mobile + tablette — barre fixée en bas */
.navbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: var(--z-navbar);
  display: flex;
  align-items: center;
  justify-content: space-around;
  height: calc(var(--navbar-height) + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--color-bg-overlay);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid var(--color-border);
}

/* Desktop — dans le header, à côté de la marque */
@media (min-width: 1024px) {
  .navbar {
    position: static;
    height: auto;
    padding: 0;
    justify-content: flex-start;
    gap: var(--space-1);
    background: transparent;
    backdrop-filter: none;
    border-top: none;
  }
}
</style>
