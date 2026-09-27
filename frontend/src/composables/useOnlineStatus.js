import { ref, onMounted, onBeforeUnmount } from 'vue'

/** État de la connexion réseau, mis à jour en direct (`online` / `offline`). */
export function useOnlineStatus() {
  const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)

  const update = () => { online.value = navigator.onLine }

  onMounted(() => {
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('online', update)
    window.removeEventListener('offline', update)
  })

  return { online }
}
