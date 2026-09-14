import { createApp }   from 'vue'
import { createPinia } from 'pinia'
import router          from './router/index.js'
import App             from './App.vue'
import { resolveInitialTheme, applyTheme } from './stores/app.store.js'
import '@/assets/styles/main.css'

// Thème appliqué avant le montage pour éviter tout flash de couleur
applyTheme(resolveInitialTheme())

const app = createApp(App)
app.use(createPinia())
app.use(router)

app.mount('#app')
