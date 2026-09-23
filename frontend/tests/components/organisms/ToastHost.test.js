/**
 * Tests composant — ToastHost
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ToastHost from '@/components/organisms/ToastHost.vue'
import { useToastStore } from '@/stores/toast.store.js'

describe('ToastHost', () => {
  it('est une zone live polie, vide au repos', () => {
    const w = mount(ToastHost)

    expect(w.find('[role="status"]').attributes('aria-live')).toBe('polite')
    expect(w.text()).toBe('')
  })

  it('affiche les notifications du store', async () => {
    const w = mount(ToastHost)

    useToastStore().success('Catégorie ajoutée.')
    await w.vm.$nextTick()

    expect(w.text()).toContain('Catégorie ajoutée.')
  })

  it('la croix ferme la notification', async () => {
    const w = mount(ToastHost)
    const toasts = useToastStore()
    toasts.success('Bientôt fermée', { duration: 0 })
    await w.vm.$nextTick()

    await w.find('button[aria-label="Fermer la notification"]').trigger('click')

    expect(toasts.items).toHaveLength(0)
  })
})
