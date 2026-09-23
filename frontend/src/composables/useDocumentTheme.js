import { ref, onMounted, onBeforeUnmount } from 'vue'

/**
 * Thème courant lu sur <html data-theme> et mis à jour en direct.
 * Permet aux composants présentationnels (graphiques…) de réagir au changement
 * de thème sans dépendre du store.
 */
export function useDocumentTheme() {
  const read  = () => document.documentElement.getAttribute('data-theme') ?? 'dark'
  const theme = ref(read())
  let observer = null

  onMounted(() => {
    theme.value = read()
    observer = new MutationObserver(() => { theme.value = read() })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  })

  onBeforeUnmount(() => observer?.disconnect())

  return theme
}
