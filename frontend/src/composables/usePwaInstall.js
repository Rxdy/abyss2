import { ref, computed } from 'vue'

/**
 * Installation de la PWA.
 *
 * Chrome/Edge/Android émettent `beforeinstallprompt` (souvent avant le montage
 * de Vue) : `listenForInstall()` doit donc être appelée au démarrage, dans
 * main.js, pour ne pas rater l'événement. iOS Safari n'a pas cet événement —
 * l'installation y est manuelle (Partager → Sur l'écran d'accueil), on expose
 * `needsManual` pour afficher les instructions.
 */

// Événement différé — `prompt()` ne peut servir qu'une seule fois.
const deferredPrompt = ref(null)
const installed      = ref(false)
let listening = false

function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)').matches === true
    || window.navigator.standalone === true
}

function isIos() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent ?? ''
  // iPadOS 13+ se présente comme un Mac : on le repère au tactile.
  const iPadOs = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return /iPad|iPhone|iPod/.test(ua) || iPadOs
}

export function listenForInstall() {
  if (listening || typeof window === 'undefined') return
  listening = true
  installed.value = isStandalone()

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPrompt.value = event
  })

  window.addEventListener('appinstalled', () => {
    installed.value = true
    deferredPrompt.value = null
  })
}

/** Remet l'état à zéro — uniquement pour les tests. */
export function resetPwaInstall() {
  deferredPrompt.value = null
  installed.value = false
  listening = false
}

export function usePwaInstall() {
  const canPrompt   = computed(() => !installed.value && deferredPrompt.value !== null)
  const needsManual = computed(() => !installed.value && deferredPrompt.value === null && isIos())
  const available   = computed(() => canPrompt.value || needsManual.value)

  /** Ouvre la boîte d'installation du navigateur. Retourne 'accepted' | 'dismissed' | 'unavailable'. */
  async function install() {
    const event = deferredPrompt.value
    if (!event) return 'unavailable'

    event.prompt()
    const { outcome } = await event.userChoice
    deferredPrompt.value = null
    return outcome
  }

  return { available, canPrompt, needsManual, installed, install }
}
