/**
 * Génère les écrans de démarrage iOS (`apple-touch-startup-image`) : le logo centré sur le
 * fond de l'app, aux dimensions exactes des iPhone et iPad. Sans eux, iOS affiche un écran
 * blanc au lancement de la PWA installée.
 *
 *   PLAYWRIGHT_CORE=/chemin/vers/node_modules/playwright-core \
 *   CHROMIUM_PATH=/chemin/vers/chrome  node frontend/scripts/ios-splash.cjs
 *
 * Écrit public/splash/*.png et remplace le bloc balisé `ios-splash` de index.html.
 * (PLAYWRIGHT_CORE et CHROMIUM_PATH sont facultatifs si Playwright est installé.)
 */

const { chromium } = require(process.env.PLAYWRIGHT_CORE ?? 'playwright-core')
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const ROOT = join(__dirname, '..')
const OUT  = join(ROOT, 'public/splash')
const BACKGROUND = '#0b0b17' // = theme_color / background_color du manifest

/** [largeur, hauteur, échelle] en points CSS — les modèles qui partagent une taille sont regroupés. */
const DEVICES = [
  [440, 956, 3],   // iPhone 16 Pro Max
  [402, 874, 3],   // iPhone 16 Pro
  [430, 932, 3],   // iPhone 16 Plus, 15 Plus, 15 Pro Max, 14 Pro Max
  [393, 852, 3],   // iPhone 16, 15, 15 Pro, 14 Pro
  [428, 926, 3],   // iPhone 14 Plus, 13 Pro Max, 12 Pro Max
  [390, 844, 3],   // iPhone 14, 13, 13 Pro, 12, 12 Pro
  [375, 812, 3],   // iPhone 13 mini, 12 mini, 11 Pro, XS, X
  [414, 896, 3],   // iPhone 11 Pro Max, XS Max
  [414, 896, 2],   // iPhone 11, XR
  [414, 736, 3],   // iPhone 8 Plus, 7 Plus
  [375, 667, 2],   // iPhone SE (2e et 3e gén.), 8, 7, 6s
  [744, 1133, 2],  // iPad mini 6
  [810, 1080, 2],  // iPad 10,2"
  [820, 1180, 2],  // iPad Air 10,9"
  [834, 1112, 2],  // iPad Pro 10,5"
  [834, 1194, 2],  // iPad Pro 11"
  [1024, 1366, 2], // iPad Pro 12,9"
]

const logo = readFileSync(join(ROOT, 'public/favicon.svg'), 'utf8')

const html = (width, height) => `<!doctype html>
<html><body style="margin:0;width:${width}px;height:${height}px;background:${BACKGROUND};display:flex;align-items:center;justify-content:center">
  <div style="width:${Math.round(Math.min(width, height) * 0.3)}px;height:${Math.round(Math.min(width, height) * 0.3)}px">${logo.replace('<svg', '<svg style="width:100%;height:100%"')}</div>
</body></html>`

;(async () => {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH })
  const links = []

  for (const [width, height, scale] of DEVICES) {
    const file = `splash-${width * scale}x${height * scale}.png`
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: scale })
    const page = await context.newPage()
    await page.setContent(html(width, height))
    await page.screenshot({ path: join(OUT, file) })
    await context.close()

    links.push(
      `    <link rel="apple-touch-startup-image" href="/splash/${file}" ` +
      `media="(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${scale}) and (orientation: portrait)" />`,
    )
    console.log('✓', file)
  }
  await browser.close()

  const indexPath = join(ROOT, 'index.html')
  const block = `    <!-- ios-splash:start (généré par scripts/ios-splash.cjs) -->\n${links.join('\n')}\n    <!-- ios-splash:end -->`
  const index = readFileSync(indexPath, 'utf8')
  const pattern = / {4}<!-- ios-splash:start[\s\S]*?<!-- ios-splash:end -->/
  writeFileSync(indexPath, pattern.test(index) ? index.replace(pattern, block) : index.replace('    <title>', `${block}\n    <title>`))
  console.log(`index.html : ${links.length} balises`)
})().catch((error) => { console.error(error); process.exit(1) })
