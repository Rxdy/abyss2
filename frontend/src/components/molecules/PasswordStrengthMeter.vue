<script setup>
/*
 * Jauge de robustesse d'un mot de passe : cinq segments (un par niveau de
 * l'échelle), allumés jusqu'au niveau atteint. Le libellé du niveau n'apparaît
 * qu'au survol de la barre ; un conseil s'affiche dessous quand il y en a un.
 * Le calcul est dans utils/passwordStrength.js.
 */
import { computed } from 'vue'
import BaseText from '@/components/atoms/BaseText.vue'
import { STRENGTH_LEVELS, evaluatePassword } from '@/utils/passwordStrength.js'

const props = defineProps({
  password: { type: String, default: '' },
})

const strength = computed(() => evaluatePassword(props.password))

/** Annoncé aux lecteurs d'écran : ne change qu'avec le niveau, pas à chaque frappe. */
const liveText = computed(() => {
  if (strength.value.level === null) return ''
  return `Robustesse : ${strength.value.label}${strength.value.acceptable ? ', niveau requis atteint' : ''}`
})
</script>

<template>
  <div class="meter">
    <div
      class="meter__bar"
      role="meter"
      aria-label="Robustesse du mot de passe"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="strength.percent"
      :aria-valuetext="strength.level === null ? 'Aucun mot de passe saisi' : strength.label"
    >
      <span
        v-for="(level, index) in STRENGTH_LEVELS"
        :key="level.label"
        class="meter__segment"
        :class="strength.level !== null && index <= strength.level && `meter__segment--on meter__segment--${strength.level}`"
      />

      <!-- Infobulle : visible au survol seulement (les lecteurs d'écran ont aria-valuetext) -->
      <span v-if="strength.level !== null" class="meter__tip" aria-hidden="true">{{ strength.label }}</span>
    </div>

    <BaseText v-if="strength.level !== null && strength.hint" as="p" size="xs" color="secondary">
      {{ strength.hint }}
    </BaseText>

    <span class="meter__live" aria-live="polite">{{ liveText }}</span>
  </div>
</template>

<style scoped>
.meter {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.meter__bar {
  position: relative;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--space-1);
  /* Zone de survol plus généreuse que les 6 px de la barre, sans changer la mise en page */
  padding-block: 0.375rem;
  margin-block: -0.375rem;
}

.meter__segment {
  height: 0.375rem;
  border-radius: var(--radius-full);
  background: var(--color-border);
  transition: background var(--transition-normal);
}

.meter__segment--0 { --on: var(--strength-0); }
.meter__segment--1 { --on: var(--strength-1); }
.meter__segment--2 { --on: var(--strength-2); }
.meter__segment--3 { --on: var(--strength-3); }
.meter__segment--4 { --on: var(--strength-4); }
.meter__segment--on { background: var(--on); }

.meter__tip {
  position: absolute;
  z-index: 1;
  top: calc(100% + var(--space-1));
  left: 50%;
  transform: translate(-50%, -2px);
  padding: 2px var(--space-2);
  border-radius: var(--radius-md);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  color: var(--color-text-primary);
  font-size: var(--text-xs);
  font-weight: var(--font-semibold);
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--transition-fast), transform var(--transition-fast);
}

.meter__bar:hover .meter__tip {
  opacity: 1;
  transform: translate(-50%, 0);
}

.meter__live {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
