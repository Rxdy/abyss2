import { defineStore } from 'pinia'

const TOKEN_KEY = 'abyss2_token'
const USER_KEY  = 'abyss2_user'

function loadUser() {
  try {
    return JSON.parse(sessionStorage.getItem(USER_KEY) ?? 'null')
  } catch {
    return null
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: sessionStorage.getItem(TOKEN_KEY) ?? null,
    user:  loadUser(),
  }),

  getters: {
    isAuthenticated: (state) => !!state.token,
  },

  actions: {
    /**
     * Appelé après une réponse réussie de l'API auth
     * @param {{ token: string, user: object }} payload
     */
    setSession({ token, user }) {
      this.token = token
      this.user  = user ?? null
      sessionStorage.setItem(TOKEN_KEY, token)
      sessionStorage.setItem(USER_KEY, JSON.stringify(this.user))
    },

    logout() {
      this.token = null
      this.user  = null
      sessionStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(USER_KEY)
    },
  },
})
