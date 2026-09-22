<script setup>
/*
 * Fenêtre modale : feuille en bas d'écran sur mobile, centrée sur ordinateur.
 *
 * - se ferme par la croix, un clic sur le fond ou Échap (événement `close` : le
 *   parent décide, par exemple après confirmation) ;
 * - `role="dialog"` + `aria-modal`, nommée par son titre ;
 * - le focus entre dans la fenêtre, y reste (Tab boucle) et revient au bouton
 *   d'origine à la fermeture ;
 * - la page derrière ne défile plus.
 * `closable="false"` suspend la fermeture (une confirmation est ouverte par-dessus).
 */
import { nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import BaseIcon   from '@/components/atoms/BaseIcon.vue'
import BaseText   from '@/components/atoms/BaseText.vue'
import IconButton from '@/components/atoms/IconButton.vue'

const props = defineProps({
  title:    { type: String, required: true },
  closable: { type: Boolean, default: true },
})

const emit = defineEmits(['close'])

const titleId = `modal-title-${useId()}`
const panel   = ref(null)
const body    = ref(null)

const FIELD = 'input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Éléments actifs de `root`, dans l'ordre du document (l'ordre de Tab). */
function focusableIn(root) {
  return [...(root?.querySelectorAll(FOCUSABLE) ?? [])].sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
  )
}

function requestClose() {
  if (props.closable) emit('close')
}

function onDocumentKeydown(event) {
  if (event.key === 'Escape') requestClose()
}

/** Tab et Maj+Tab bouclent à l'intérieur de la fenêtre. */
function onPanelKeydown(event) {
  if (event.key !== 'Tab') return

  const items = focusableIn(panel.value)
  if (items.length === 0) {
    event.preventDefault()
    return
  }

  const first = items[0]
  const last  = items[items.length - 1]
  const active = document.activeElement

  if (event.shiftKey && (active === first || !panel.value.contains(active))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || !panel.value.contains(active))) {
    event.preventDefault()
    first.focus()
  }
}

// ── Défilement de la page bloqué (compteur : des modales peuvent s'empiler) ──
let scrollLocks = 0
let overflowBefore = ''

function lockScroll() {
  if (scrollLocks++ === 0) {
    overflowBefore = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
}

function unlockScroll() {
  if (--scrollLocks === 0) document.body.style.overflow = overflowBefore
}

let opener = null

onMounted(async () => {
  opener = document.activeElement
  lockScroll()
  document.addEventListener('keydown', onDocumentKeydown)

  await nextTick()
  // Premier champ de saisie s'il y en a un (même précédé de boutons, comme le choix Dépense / Revenu),
  // sinon premier élément actif, sinon la fenêtre.
  const inBody = focusableIn(body.value)
  const target = inBody.find((el) => el.matches(FIELD)) ?? inBody[0] ?? focusableIn(panel.value)[0] ?? panel.value
  target?.focus()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocumentKeydown)
  unlockScroll()
  if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus()
})
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" role="presentation" @mousedown.self="requestClose">
      <div
        ref="panel"
        class="modal"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
        @keydown="onPanelKeydown"
      >
        <header class="modal__head">
          <BaseText :id="titleId" as="h2" size="lg" weight="semibold" color="primary">{{ title }}</BaseText>
          <IconButton label="Fermer" @click="requestClose">
            <BaseIcon name="close" :size="18" />
          </IconButton>
        </header>

        <div ref="body" class="modal__body">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  display: flex;
  align-items: flex-end; /* mobile : feuille collée en bas */
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

.modal {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: 92vh;
  max-height: 92dvh;
  background: var(--color-bg-surface);
  border-top: 1px solid var(--color-border);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: var(--shadow-lg);
  padding-bottom: env(safe-area-inset-bottom);
  animation: modal-slide-up var(--transition-normal) both;
}

.modal:focus { outline: none; }

.modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--color-border);
}

.modal__body {
  overflow-y: auto;
  padding: var(--space-5);
}

@media (min-width: 640px) {
  .modal-overlay {
    align-items: center;
    padding: var(--space-4);
  }

  .modal {
    max-width: 28rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding-bottom: 0;
    animation-name: modal-fade-in;
  }
}

@keyframes modal-slide-up {
  from { transform: translateY(100%); }
  to   { transform: none; }
}

@keyframes modal-fade-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .modal { animation: none; }
}
</style>
