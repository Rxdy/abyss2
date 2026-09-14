import { defineStore } from 'pinia'

const THEME_KEY = 'abyss2_theme'

/**
 * Thème initial : choix explicite de l'utilisateur > préférence système > sombre.
 */
export function resolveInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved

  const prefersLight = typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-color-scheme: light)').matches

  return prefersLight ? 'light' : 'dark'
}

/**
 * Applique le thème sur <html> — c'est `data-theme` qui pilote les variables CSS.
 */
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

export const useAppStore = defineStore('app', {
  state: () => ({
    theme: 'dark',
  }),

  getters: {
    isDark:  (state) => state.theme === 'dark',
    isLight: (state) => state.theme === 'light',
  },

  actions: {
    /** Lit la préférence stockée (ou système) et l'applique. */
    initTheme() {
      this.setTheme(resolveInitialTheme())
    },

    setTheme(theme) {
      this.theme = theme === 'light' ? 'light' : 'dark'
      localStorage.setItem(THEME_KEY, this.theme)
      applyTheme(this.theme)
    },

    toggleTheme() {
      this.setTheme(this.theme === 'dark' ? 'light' : 'dark')
    },
  },
})
