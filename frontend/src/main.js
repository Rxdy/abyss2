import { createApp }   from 'vue'
import { createPinia } from 'pinia'
import router          from './router/index.js'
import App             from './App.vue'
import { resolveInitialTheme, applyTheme } from './stores/app.store.js'
import { registerSW } from 'virtual:pwa-register'
import { listenForInstall } from './composables/usePwaInstall.js'
import { registerPwaUpdates } from './composables/usePwaUpdate.js'
import '@/assets/styles/main.css'

// Pas de zoom au pincement : iOS ignore `user-scalable=no` (index.html) depuis iOS 10, mais laisse
// annuler ses événements `gesture*`, qui n'existent que sur Safari/WebKit — sans effet ailleurs.
for (const type of ['gesturestart', 'gesturechange']) {
  document.addEventListener(type, (event) => event.preventDefault(), { passive: false })
}

// Thème appliqué avant le montage pour éviter tout flash de couleur
applyTheme(resolveInitialTheme())

// `beforeinstallprompt` peut partir avant le montage de Vue : on l'écoute tout de suite
listenForInstall()

// Service worker : la nouvelle version est annoncée à l'utilisateur (bannière), jamais imposée
registerPwaUpdates(registerSW)

const app = createApp(App)
app.use(createPinia())
app.use(router)

app.mount('#app')
