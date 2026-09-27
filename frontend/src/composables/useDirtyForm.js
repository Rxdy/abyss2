import { computed, inject, ref, watch } from 'vue'

/** Clé de `provide` : FormModal y expose `setDirty` aux formulaires qu'il contient. */
export const FORM_MODAL_KEY = Symbol('form-modal')

/**
 * Détecte qu'un formulaire a été modifié depuis son ouverture, et le signale à
 * la modale qui l'enveloppe (s'il y en a une) pour qu'elle demande confirmation
 * avant de fermer. `form` est une ref : on compare sa valeur à un instantané
 * pris à l'appel, donc à appeler juste après l'avoir initialisée.
 */
export function useDirtyForm(form) {
  const modal = inject(FORM_MODAL_KEY, null)
  const snapshot = ref(JSON.stringify(form.value))
  const dirty = computed(() => JSON.stringify(form.value) !== snapshot.value)

  watch(dirty, (value) => modal?.setDirty(value), { immediate: true })

  return { dirty }
}
