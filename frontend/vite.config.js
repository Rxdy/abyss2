import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Abyss2 — suivi de dépenses',
        short_name: 'Abyss2',
        description: 'Suivi de dépenses personnelles à saisie manuelle.',
        lang: 'fr',
        theme_color: '#0d0d1a',
        background_color: '#0d0d1a',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png',          sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512.png',          sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'favicon.svg',          sizes: 'any',     type: 'image/svg+xml', purpose: 'any' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
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
