// Tests de bout en bout : un vrai navigateur, l'app réelle (front + API + PostgreSQL).
// La pile doit tourner : `make up`. Chaque test crée son propre compte et le supprime à la fin.
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  // Comptes distincts, mais l'API limite le débit par IP : on enchaîne plutôt que de tout lancer d'un coup.
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'fr-FR',
    // Le service worker de développement met des réponses en cache : on l'écarte pour des tests reproductibles.
    serviceWorkers: 'block',
  },
  projects: [
    { name: 'mobile',  use: { ...devices['Pixel 5'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
  ],
})
