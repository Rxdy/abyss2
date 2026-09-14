import { defineConfig } from 'vitest/config'

/**
 * Tests d'intégration base de données — nécessitent un PostgreSQL joignable
 * via DATABASE_URL (docker compose up postgres).
 * Exécution séquentielle : les tests écrivent dans la vraie base.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/db/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
  },
})
