<script setup>
/*
 * Évolution d'un total par rapport à une période précédente : flèche, pourcentage
 * et rappel de la période comparée. La couleur dit si l'évolution est favorable
 * (une dépense qui baisse est verte), pas seulement son sens.
 */
import { computed } from 'vue'
import BaseText from '@/components/atoms/BaseText.vue'

const props = defineProps({
  /** Écart en % ; null : rien à quoi comparer */
  percent:   { type: Number, default: null },
  direction: { type: String, default: 'flat' },   // 'up' | 'down' | 'flat'
  tone:      { type: String, default: 'neutral' }, // 'good' | 'bad' | 'neutral'
  /** Période comparée : « août 2026 » */
  label:     { type: String, required: true },
})

const ARROWS = { up: '▲', down: '▼', flat: '■' }

const percentText = computed(() =>
  new Intl.NumberFormat('fr-FR', { signDisplay: 'exceptZero', maximumFractionDigits: 1 }).format(props.percent) + ' %',
)

const spoken = computed(() => {
  if (props.percent === null) return `Aucune donnée sur ${props.label} pour comparer.`
  if (props.direction === 'flat') return `Identique à ${props.label}.`
  return `${props.direction === 'up' ? 'En hausse' : 'En baisse'} de ${percentText.value.replace(/^[+−-]/, '')} par rapport à ${props.label}.`
})
</script>

<template>
  <p class="trend" :class="`trend--${tone}`">
    <span class="trend__sr">{{ spoken }}</span>

    <span aria-hidden="true" class="trend__visual">
      <template v-if="percent === null">
        <BaseText as="span" size="xs" color="muted">Pas de données en {{ label }}</BaseText>
      </template>
      <template v-else>
        <span class="trend__value">
          <span class="trend__arrow">{{ ARROWS[direction] }}</span>{{ percentText }}
        </span>
        <BaseText as="span" size="xs" color="muted">vs {{ label }}</BaseText>
      </template>
    </span>
  </p>
</template>

<style scoped>
.trend {
  display: flex;
  align-items: baseline;
}

.trend__visual {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-2);
}

.trend__value {
  display: inline-flex;
  align-items: baseline;
  gap: var(--space-1);
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  font-variant-numeric: tabular-nums;
  color: var(--color-text-secondary);
}

.trend__arrow { font-size: 0.65em; }

.trend--good .trend__value { color: var(--color-success); }
.trend--bad  .trend__value { color: var(--color-danger); }

.trend__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
