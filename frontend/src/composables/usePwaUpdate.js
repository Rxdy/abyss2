import { computed, ref } from 'vue'

/**
 * Mise à jour de la PWA.
 *
 * Le service worker télécharge la nouvelle version en arrière-plan, mais ne
 * l'active pas tout seul : recharger l'app en plein milieu d'une saisie ferait
 * perdre ce qui est en cours. Il prévient (`onNeedRefresh`) ; l'utilisateur choisit
 * le moment (« Mettre à jour »), ce qui active la nouvelle version et recharge.
 *
 * `registerPwaUpdates()` est appelée au démarrage, dans main.js, avec le
 * `registerSW` du plugin — passé en argument pour que ce module reste testable
 * (le module virtuel du plugin n'existe pas sous Vitest).
 */

/** Une app installée peut rester ouverte des jours : on cherche une nouvelle version chaque heure… */
export const CHECK_EVERY_MS = 60 * 60 * 1000

const updateReady = ref(false)
const dismissed   = ref(false)
let applyUpdate  = null
let registration = null
let timer        = null
let listening    = false

/** Cherche une nouvelle version. Hors ligne, l'échec est sans importance. */
function check() {
  if (registration) Promise.resolve(registration.update()).catch(() => {})
}

/** Un seul minuteur et un seul écouteur, quel que soit le nombre d'enregistrements. */
function watchForUpdates(swRegistration) {
  registration = swRegistration
  clearInterval(timer)
  timer = setInterval(check, CHECK_EVERY_MS)

  // …et dès qu'on revient sur l'app (onglet ou application remise au premier plan)
  if (!listening) {
    listening = true
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check()
    })
  }
}

export function registerPwaUpdates(registerSW) {
  applyUpdate = registerSW({
    onNeedRefresh() {
      updateReady.value = true
      dismissed.value = false // une nouvelle version après un « plus tard » : on le redit
    },

    onRegisteredSW(_url, swRegistration) {
      if (swRegistration) watchForUpdates(swRegistration)
    },
  })
}

/** Remet l'état à zéro — uniquement pour les tests. */
export function resetPwaUpdate() {
  updateReady.value = false
  dismissed.value = false
  applyUpdate = null
  registration = null
  clearInterval(timer)
  timer = null
}

export function usePwaUpdate() {
  return {
    /** Une nouvelle version est prête à être activée. */
    updateReady,
    /** À afficher : prête, et pas repoussée. */
    visible: computed(() => updateReady.value && !dismissed.value),
    /** Active la nouvelle version et recharge l'app. */
    update: () => applyUpdate?.(true),
    /** « Plus tard » : masque l'invitation jusqu'à la prochaine version. */
    dismiss: () => { dismissed.value = true },
  }
}
