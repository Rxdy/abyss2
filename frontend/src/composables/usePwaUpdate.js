import { computed, ref } from 'vue'

/**
 * Mise à jour de la PWA.
 *
 * Le service worker télécharge la nouvelle version en arrière-plan, puis prévient
 * (`onNeedRefresh`). Deux cas :
 *
 * - elle arrive juste après l'ouverture de l'app, ou juste après y être revenu
 *   (AUTO_APPLY_WINDOW_MS) : rien n'est encore en cours de saisie, elle est activée
 *   aussitôt, rechargement compris. C'est le cas courant — sans ça, une app installée
 *   restait sur l'ancienne version tant que personne ne voyait le bandeau (absent des
 *   pages de connexion), au point de devoir la réinstaller ;
 * - elle arrive en cours d'utilisation : recharger ferait perdre ce qui est en cours,
 *   l'utilisateur choisit le moment (bandeau « Mettre à jour »).
 *
 * `registerPwaUpdates()` est appelée au démarrage, dans main.js, avec le
 * `registerSW` du plugin — passé en argument pour que ce module reste testable
 * (le module virtuel du plugin n'existe pas sous Vitest).
 */

/** Une app installée peut rester ouverte des jours : on cherche une nouvelle version chaque heure… */
export const CHECK_EVERY_MS = 60 * 60 * 1000

/** Délai après l'ouverture (ou le retour dans l'app) pendant lequel une nouvelle version s'installe d'office. */
export const AUTO_APPLY_WINDOW_MS = 30 * 1000

const updateReady = ref(false)
const dismissed   = ref(false)
let applyUpdate  = null
let registration = null
let timer        = null
let listening    = false
let openedAt     = 0

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
      if (document.visibilityState !== 'visible') return
      openedAt = Date.now()
      check()
    })
  }
}

export function registerPwaUpdates(registerSW) {
  openedAt = Date.now()
  applyUpdate = registerSW({
    onNeedRefresh() {
      if (Date.now() - openedAt < AUTO_APPLY_WINDOW_MS) {
        applyUpdate?.(true)
        return
      }
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
  openedAt = 0
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
