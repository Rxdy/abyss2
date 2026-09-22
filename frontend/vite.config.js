import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      // 'prompt' : la nouvelle version est prête mais activée au choix de l'utilisateur (bannière), pas
      // rechargée en silence. L'enregistrement est fait dans src/main.js.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Abyss2 — suivi de dépenses',
        short_name: 'Abyss2',
        description: 'Suivi de dépenses personnelles à saisie manuelle.',
        lang: 'fr',
        theme_color: '#0b0b17',
        background_color: '#0b0b17',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        // Appui long sur l'icône de l'app installée
        shortcuts: [
          {
            name: 'Ajouter une transaction',
            short_name: 'Ajouter',
            url: '/transactions?new=1',
            icons: [{ src: 'pwa-192.png', sizes: '192x192', type: 'image/png' }]
          },
          {
            name: 'Statistiques',
            url: '/stats',
            icons: [{ src: 'pwa-192.png', sizes: '192x192', type: 'image/png' }]
          }
        ],
        // Installation enrichie (boîte de dialogue détaillée de Chrome / Edge) ; régénérées par
        // scripts/pwa-screenshots.cjs
        screenshots: [
          { src: 'screenshots/home-narrow.png',         sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'Accueil : solde du mois et dernières transactions' },
          { src: 'screenshots/transactions-narrow.png', sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'Transactions : recherche, filtres et ajout rapide' },
          { src: 'screenshots/stats-narrow.png',        sizes: '780x1688', type: 'image/png', form_factor: 'narrow', label: 'Statistiques : répartition par catégorie et évolution' },
          { src: 'screenshots/home-wide.png',           sizes: '1280x800', type: 'image/png', form_factor: 'wide',   label: 'Accueil sur ordinateur' },
          { src: 'screenshots/stats-wide.png',          sizes: '1280x800', type: 'image/png', form_factor: 'wide',   label: 'Statistiques sur ordinateur' }
        ],
        icons: [
          { src: 'pwa-192.png',          sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png',          sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'favicon.svg',          sizes: 'any',     type: 'image/svg+xml', purpose: 'any' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // Captures du manifest et écrans de démarrage iOS ne servent qu'à l'installation / au lancement :
        // inutile de les précacher
        globIgnores: ['screenshots/**', 'splash/**'],
        // SPA : toute navigation inconnue retombe sur index.html
        navigateFallback: 'index.html',
        // L'API n'est jamais mise en cache par le SW (données sensibles + JWT)
        navigateFallbackDenylist: [/^\/api/],
        cleanupOutdatedCaches: true
      },
      // Permet de tester l'installabilité et le SW en `npm run dev`
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html'
      }
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // En conteneur, inotify est une ressource hôte partagée (EMFILE quand
    // plusieurs projets tournent) → polling activé par CHOKIDAR_USEPOLLING.
    watch: process.env.CHOKIDAR_USEPOLLING === 'true'
      ? { usePolling: true, interval: Number(process.env.CHOKIDAR_INTERVAL ?? 600) }
      : undefined
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{js,vue}'],
      exclude: ['src/main.js', 'src/router/**'],
    },
  },
})
