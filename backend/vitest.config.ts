import { defineConfig } from 'vitest/config'

/**
 * Tests unitaires / d'intégration API — Prisma est mocké, aucune base requise.
 * Les tests qui touchent la vraie base sont dans tests/db (voir vitest.db.config.ts).
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/db/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts'],
    },
  },
})
