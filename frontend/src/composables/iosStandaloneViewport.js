/**
 * Hauteur de l'app installée sur iPhone.
 *
 * En PWA iOS avec la barre d'état translucide (viewport-fit=cover), le bloc conteneur initial —
 * le repère de `position: fixed`, de `inset: 0` et des hauteurs en % — s'arrête avant le bas de
 * l'écran, de la hauteur de la barre d'état. Tout ce qui est fixé en bas (navbar, bouton flottant,
 * toasts, feuilles modales) flottait donc au-dessus d'une bande vide.
 *
 * La taille de l'écran, elle, est connue : on la donne au body (`--app-height`) et la classe
 * `ios-standalone` en fait le repère des éléments fixés (voir _reset.css). Rien ne change hors
 * de l'app installée sur iOS : `navigator.standalone` n'existe que là.
 */

export function fitIosStandaloneViewport(win = window) {
  if (win.navigator?.standalone !== true) return

  const root = win.document.documentElement

  function apply() {
    const { width, height } = win.screen
    // `screen` ne pivote pas avec l'appareil sur iOS : on remet les côtés dans l'ordre.
    const landscape = win.screen.orientation?.type?.startsWith('landscape') ?? win.innerWidth > win.innerHeight
    const screenWidth  = landscape ? Math.max(width, height) : Math.min(width, height)
    const screenHeight = landscape ? Math.min(width, height) : Math.max(width, height)

    // iPad en écran partagé : la fenêtre n'occupe pas tout l'écran, sa hauteur n'est pas celle de l'écran.
    if (win.innerWidth !== screenWidth) {
      root.classList.remove('ios-standalone')
      return
    }
    root.style.setProperty('--app-height', `${screenHeight}px`)
    root.classList.add('ios-standalone')
  }

  apply()
  win.addEventListener('resize', apply)
}
