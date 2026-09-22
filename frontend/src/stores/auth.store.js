import { defineStore } from 'pinia'

// Le jeton de session ne vit plus que dans un cookie httpOnly (voir backend/src/utils/session.ts) :
// illisible en JavaScript, donc rien à stocker ici pour authentifier les requêtes — le navigateur
// s'en charge tout seul (`credentials: 'include'`, voir useApi.js).
//
// `HAS_SESSION_KEY` n'est qu'un indice optimiste, jamais une preuve : il sert uniquement à ce que le
// garde de route (router/index.js) sache, de façon synchrone et avant tout aller-retour réseau, s'il
// doit laisser passer une navigation vers une page protégée. `localStorage` (et non `sessionStorage`)
// est volontaire : contrairement à un onglet, il survit à la fermeture de l'app installée (PWA), donc
// ne perd plus la session à chaque redémarrage — App.vue revalide ensuite pour de vrai auprès de
// l'API et corrige cet indice s'il ment (cookie expiré, déconnecté ailleurs, etc.).
const HAS_SESSION_KEY = 'abyss2_has_session'
const USER_KEY        = 'abyss2_user'

function loadUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null')
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    hasSession: localStorage.getItem(HAS_SESSION_KEY) === '1',
    user: loadUser(),
    // Jeton CSRF : seulement en mémoire, jamais persisté. Il redevient inutile après un rechargement
    // de toute façon (App.vue en redemande un frais via GET /api/user au démarrage).
    csrfToken: null,
  }),

  getters: {
    isAuthenticated: (state) => state.hasSession,
  },

  actions: {
    /**
     * Appelé après une connexion/inscription réussie, ou une revalidation de session au démarrage.
     * @param {{ user?: object, csrfToken?: string }} payload
     */
    setSession({ user, csrfToken } = {}) {
      this.hasSession = true
      localStorage.setItem(HAS_SESSION_KEY, '1')
      if (user !== undefined) {
        this.user = user
        localStorage.setItem(USER_KEY, JSON.stringify(user))
      }
      if (csrfToken !== undefined) {
        this.csrfToken = csrfToken
      }
    },

    /** Renouvelle juste le jeton CSRF (mot de passe changé : nouvelle session, même appareil, on reste connecté). */
    setCsrfToken(csrfToken) {
      this.csrfToken = csrfToken
    },

    /** Déconnexion : efface le cookie côté serveur, puis l'état local dans tous les cas. */
    async logout() {
      try {
        const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3002'
        await fetch(`${BASE_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' })
      } catch {
        // Panne réseau : le cookie survivra côté navigateur jusqu'à son expiration (7 jours), mais
        // l'état local est effacé ci-dessous dans tous les cas — l'app se comporte comme déconnectée.
      } finally {
        this.hasSession = false
        this.user       = null
        this.csrfToken  = null
        localStorage.removeItem(HAS_SESSION_KEY)
        localStorage.removeItem(USER_KEY)
      }
    },
  },
})
