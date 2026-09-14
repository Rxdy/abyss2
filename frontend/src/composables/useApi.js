import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store.js'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3002'

export function useApi() {
  const loading = ref(false)
  const error   = ref(null)
  const auth    = useAuthStore()

  async function request(path, options = {}) {
    loading.value = true
    error.value   = null
    try {
      const headers = { ...options.headers }

      if (options.body !== undefined) {
        headers['Content-Type'] = 'application/json'
      }

      if (auth.token) {
        headers.Authorization = `Bearer ${auth.token}`
      }

      const res  = await fetch(`${BASE_URL}${path}`, { headers, ...options })
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

  return { loading, error, get, post, put, del, api, request }
}
