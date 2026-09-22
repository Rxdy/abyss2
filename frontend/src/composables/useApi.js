import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store.js'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3002'

/** Méthodes qui modifient des données : seules elles exigent le jeton CSRF (voir useApi ci-dessous). */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH'])

export function useApi() {
  const loading = ref(false)
  const error   = ref(null)
  const auth    = useAuthStore()

  async function request(path, options = {}) {
    loading.value = true
    error.value   = null
    try {
      const method  = (options.method ?? 'GET').toUpperCase()
      const headers = { ...options.headers }

      if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json'
      }

      // Le cookie de session part automatiquement avec `credentials: 'include'` ; une requête qui
      // modifie des données doit en plus prouver qu'elle vient bien de ce site (voir
      // backend/src/utils/session.ts et fastify.csrfIfCookie).
      if (MUTATING_METHODS.has(method) && auth.csrfToken) {
        headers['X-CSRF-Token'] = auth.csrfToken
      }

      // `headers` après `...options` : une requête qui passerait ses propres `headers` ne doit pas
      // écraser ceux calculés ci-dessus (Content-Type, X-CSRF-Token).
      const res  = await fetch(`${BASE_URL}${path}`, { ...options, headers, credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)
      return data
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  /** Télécharge un fichier protégé et l'enregistre sous `filename`. Lecture seule : pas de jeton CSRF requis. */
  async function download(path, filename) {
    loading.value = true
    error.value   = null
    try {
      const res = await fetch(`${BASE_URL}${path}`, { credentials: 'include' })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? `HTTP ${res.status}`)
      }

      const url = URL.createObjectURL(await res.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      error.value = e.message
      throw e
    } finally {
      loading.value = false
    }
  }

  const get  = (path, opts = {}) => request(path, { method: 'GET', ...opts })
  const post = (path, body, opts = {}) =>
    request(path, { method: 'POST', body: JSON.stringify(body), ...opts })
  const put  = (path, body, opts = {}) =>
    request(path, { method: 'PUT', body: JSON.stringify(body), ...opts })
  const del  = (path, body, opts = {}) =>
    request(path, { method: 'DELETE', ...(body !== undefined ? { body: JSON.stringify(body) } : {}), ...opts })

  // Fonction générique pour les cas complexes
  function api(path, options = {}) {
    if (options.body && typeof options.body === 'object') {
      options.body = JSON.stringify(options.body)
    }
    return request(path, options)
  }

  return { loading, error, get, post, put, del, api, request, download }
}
