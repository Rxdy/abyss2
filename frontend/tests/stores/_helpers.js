import { vi } from 'vitest'

/**
 * Remplace fetch par un routeur minimal : `handler({ method, url: URL, body })`
 * renvoie `{ body, ok = true, status = 200 }`. Renvoie le mock, dont on lit les appels
 * avec `calls(fetchMock)`.
 */
export function mockApi(handler) {
  const fetchMock = vi.fn(async (url, options = {}) => {
    const { body, ok = true, status = 200 } = handler({
      method: options.method ?? 'GET',
      url: new URL(url),
      body: options.body ? JSON.parse(options.body) : undefined,
    })
    return { ok, status, json: async () => body }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

export const calls = (fetchMock) =>
  fetchMock.mock.calls.map(([url, options = {}]) => ({
    method: options.method ?? 'GET',
    path: new URL(url).pathname + new URL(url).search,
    body: options.body ? JSON.parse(options.body) : undefined,
  }))
