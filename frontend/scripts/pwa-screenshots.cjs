/**
 * Régénère les captures d'écran du manifest PWA (public/screenshots/*.png) à
 * partir de l'app qui tourne, avec le compte de démo (make seed).
 *
 *   make seed
 *   PLAYWRIGHT_CORE=/chemin/vers/node_modules/playwright-core \
 *   CHROMIUM_PATH=/chemin/vers/chrome  node frontend/scripts/pwa-screenshots.cjs
 *
 * PLAYWRIGHT_CORE et CHROMIUM_PATH sont facultatifs si `playwright-core` est
 * installé et qu'un Chromium de Playwright est disponible.
 *
 * Les tailles doivent rester celles déclarées dans vite.config.js (manifest.screenshots).
 */

const { chromium } = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core')
const { join } = require('node:path')

const BASE = process.env.APP_URL ?? 'http://localhost:5174'
const OUT  = join(__dirname, '../public/screenshots')

const SHOTS = [
  // form_factor « narrow » : téléphone, 390 × 844 à l'échelle 2 → 780 × 1688
  { file: 'home-narrow.png',         path: '/',             viewport: [390, 844],  scale: 2 },
  { file: 'transactions-narrow.png', path: '/transactions', viewport: [390, 844],  scale: 2, wait: /\d+ opérations/ },
  { file: 'stats-narrow.png',        path: '/stats',        viewport: [390, 844],  scale: 2, wait: '.trend' },
  // form_factor « wide » : ordinateur, 1280 × 800
  { file: 'home-wide.png',           path: '/',             viewport: [1280, 800], scale: 1 },
  { file: 'stats-wide.png',          path: '/stats',        viewport: [1280, 800], scale: 1, wait: '.trend' },
]

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
  for (const { file, path, viewport: [width, height], scale, wait } of SHOTS) {
    const context = await browser.newContext({
      viewport: { width, height }, deviceScaleFactor: scale, colorScheme: 'dark', serviceWorkers: 'block', locale: 'fr-FR',
    })
    const page = await context.newPage()

    await page.goto(`${BASE}/login`)
    await page.locator('input[type=email]').fill('demo@abyss2.dev')
    await page.locator('input[type=password]').fill('demo1234')
    await page.locator('button[type=submit]').click()
    await page.waitForURL((url) => !url.pathname.includes('login'))

    await page.goto(`${BASE}${path}`)
    if (typeof wait === 'string') await page.locator(wait).waitFor()
    else if (wait) await page.getByText(wait).first().waitFor()
    await page.waitForTimeout(1500) // fin des transitions et des graphiques

    await page.screenshot({ path: join(OUT, file) })
    console.log('✓', file, `${width * scale}×${height * scale}`)
    await context.close()
  }
  await browser.close()
})().catch((error) => { console.error(error); process.exit(1) })
