import { defineStore } from 'pinia'

const THEME_KEY = 'abyss2_theme'

/** Choix possibles dans le Profil : un thème fixe, ou suivre l'appareil. */
export const THEME_PREFERENCES = ['dark', 'light', 'system']

const LIGHT_QUERY = '(prefers-color-scheme: light)'

function mediaQuery() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(LIGHT_QUERY)
    : null
}

/** Thème de l'appareil — sombre si le navigateur ne sait pas le dire. */
function systemTheme() {
  return mediaQuery()?.matches ? 'light' : 'dark'
}

/** Préférence enregistrée ; « système » si rien (ou rien de valide) n'est stocké. */
export function readThemePreference() {
  const saved = localStorage.getItem(THEME_KEY)
  return THEME_PREFERENCES.includes(saved) ? saved : 'system'
}

/**
 * Thème initial : choix explicite de l'utilisateur > préférence système > sombre.
 */
export function resolveInitialTheme() {
  const preference = readThemePreference()
  return preference === 'system' ? systemTheme() : preference
}

/**
 * Applique le thème sur <html> — c'est `data-theme` qui pilote les variables CSS.
 */
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

/** Requête déjà écoutée — l'écoute n'est branchée qu'une fois par requête (l'app n'a qu'une racine). */
let listenedQuery = null

export const useAppStore = defineStore('app', {
  state: () => ({
    /** Thème effectivement affiché. */
    theme: 'dark',
    /** Réglage choisi dans le Profil : 'dark' | 'light' | 'system'. */
    preference: 'system',
  }),

  getters: {
    isDark:  (state) => state.theme === 'dark',
    isLight: (state) => state.theme === 'light',
  },

  actions: {
    /** Lit la préférence stockée (ou système), l'applique, et suit l'appareil en mode « système ». */
    initTheme() {
      this.setPreference(readThemePreference())

      const query = mediaQuery()
      if (query && typeof query.addEventListener === 'function' && query !== listenedQuery) {
        listenedQuery = query
        query.addEventListener('change', () => {
          const app = useAppStore()
          if (app.preference === 'system') app.applyPreference()
        })
      }
    },

    setPreference(preference) {
      this.preference = THEME_PREFERENCES.includes(preference) ? preference : 'system'
      localStorage.setItem(THEME_KEY, this.preference)
      this.applyPreference()
    },

    applyPreference() {
      this.theme = this.preference === 'system' ? systemTheme() : this.preference
      applyTheme(this.theme)
    },

    /** Thème fixe (bascule rapide des pages de connexion) — une valeur inconnue retombe sur sombre. */
    setTheme(theme) {
      this.setPreference(theme === 'light' ? 'light' : 'dark')
    },

    toggleTheme() {
      this.setTheme(this.theme === 'dark' ? 'light' : 'dark')
    },
  },
})
