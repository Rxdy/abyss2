import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore }                   from '@/stores/auth.store.js'

const routes = [
  // ── Auth (pas de header/footer) ──────────────────────────
  {
    path: '/login',
    name: 'login',
    component: () => import('@/pages/LoginPage.vue'),
    meta: { layout: 'auth', title: 'Connexion', guestOnly: true }
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('@/pages/RegisterPage.vue'),
    meta: { layout: 'auth', title: 'Inscription', guestOnly: true }
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('@/pages/ForgotPasswordPage.vue'),
    meta: { layout: 'auth', title: 'Mot de passe oublié', guestOnly: true }
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('@/pages/ResetPasswordPage.vue'),
    meta: { layout: 'auth', title: 'Nouveau mot de passe', guestOnly: true }
  },

  // ── App (layout par défaut — protégées) ──────────────────
  {
    path: '/',
    name: 'home',
    component: () => import('@/pages/HomePage.vue'),
    meta: { layout: 'default', title: 'Accueil', requiresAuth: true }
  },

  {
    path: '/transactions',
    name: 'transactions',
    component: () => import('@/pages/TransactionsPage.vue'),
    meta: { layout: 'default', title: 'Transactions', requiresAuth: true }
  },
  {
    path: '/notifications',
    name: 'notifications',
    component: () => import('@/pages/NotificationsPage.vue'),
    meta: { layout: 'default', title: 'Notifications', requiresAuth: true }
  },
  {
    path: '/stats',
    name: 'stats',
    component: () => import('@/pages/StatsPage.vue'),
    meta: { layout: 'default', title: 'Statistiques', requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('@/pages/ProfilePage.vue'),
    meta: { layout: 'default', title: 'Profil', requiresAuth: true }
  },
  {
    path: '/profile/categories',
    name: 'categories',
    component: () => import('@/pages/CategoriesPage.vue'),
    meta: { layout: 'default', title: 'Catégories', requiresAuth: true }
  },
  {
    path: '/profile/envelopes',
    name: 'envelopes',
    component: () => import('@/pages/EnvelopesPage.vue'),
    meta: { layout: 'default', title: 'Enveloppes', requiresAuth: true }
  },
  {
    path: '/recurring',
    name: 'recurring',
    component: () => import('@/pages/RecurringPage.vue'),
    meta: { layout: 'default', title: 'Charges fixes', requiresAuth: true }
  },

  // ── 404 ───────────────────────────────────────────────────
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/pages/NotFoundPage.vue'),
    meta: { layout: 'default', title: '404' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return savedPosition
    return { top: 0, behavior: 'smooth' }
  }
})

// ── Guard auth ───────────────────────────────────────────────
router.beforeEach((to) => {
  const auth = useAuthStore()
  const isAuthenticated = auth.isAuthenticated

  // Route protégée et utilisateur non connecté → login
  if (to.meta.requiresAuth && !isAuthenticated) {
    return { name: 'login' }
  }

  // Déjà connecté → pas besoin d'aller sur login / register
  if (to.meta.guestOnly && isAuthenticated) {
    return { name: 'home' }
  }
})

router.afterEach((to) => {
  const title = to.meta?.title
  document.title = title ? `${title} — Abyss2` : 'Abyss2'
})

export default router
