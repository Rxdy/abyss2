<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import BaseButton  from '@/components/atoms/BaseButton.vue'
import BaseChip    from '@/components/atoms/BaseChip.vue'
import BaseIcon    from '@/components/atoms/BaseIcon.vue'
import BaseText    from '@/components/atoms/BaseText.vue'
import CalendarDay from '@/components/atoms/CalendarDay.vue'
import IconButton  from '@/components/atoms/IconButton.vue'
import { formatShortDate } from '@/utils/format.js'

/**
 * Un seul bouton résumant la période, qui déplie un vrai calendrier :
 * on clique une première date (le début), puis une seconde dans le même
 * calendrier (la fin) — comme un sélecteur d'intervalle classique.
 */
const props = defineProps({
  from: { type: String, default: '' },
  to:   { type: String, default: '' },
})

const emit = defineEmits(['change'])

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const monthLabelFormat = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })

/** Date locale (pas UTC) → 'YYYY-MM-DD', pour matcher les <input type="date"> et les filtres existants. */
function toDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseDateStr(value) {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const root = ref(null)
const open = ref(false)
const rangeStart = ref(props.from || '')
const rangeEnd   = ref(props.to || '')
const hoverDate  = ref('')
const viewDate   = ref(parseDateStr(props.from) ?? new Date())

watch(() => [props.from, props.to], ([from, to]) => {
  rangeStart.value = from || ''
  rangeEnd.value   = to || ''
})

const label = computed(() => {
  if (rangeStart.value && rangeEnd.value) return `${formatShortDate(rangeStart.value)} → ${formatShortDate(rangeEnd.value)}`
  if (rangeStart.value) return `Depuis le ${formatShortDate(rangeStart.value)}`
  return 'Toutes les dates'
})

const hasRange = computed(() => !!(rangeStart.value || rangeEnd.value))
const monthLabel = computed(() => {
  const label = monthLabelFormat.format(viewDate.value)
  return label.charAt(0).toUpperCase() + label.slice(1)
})

/** Grille du mois affiché : semaines complètes (lundi → dimanche), jours hors mois inclus pour remplir. */
const days = computed(() => {
  const year  = viewDate.value.getFullYear()
  const month = viewDate.value.getMonth()
  const firstOfMonth   = new Date(year, month, 1)
  const daysInMonth    = new Date(year, month + 1, 0).getDate()
  const leading        = (firstOfMonth.getDay() + 6) % 7 // 0 = lundi

  const todayStr = toDateStr(new Date())
  const cells = []

  for (let i = 0; i < leading; i++) {
    const date = new Date(year, month, i - leading + 1)
    cells.push({ date, dateStr: toDateStr(date), inMonth: false })
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    cells.push({ date, dateStr: toDateStr(date), inMonth: true })
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date
    const date = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1)
    cells.push({ date, dateStr: toDateStr(date), inMonth: false })
  }

  return cells.map((cell) => ({
    ...cell,
    day: cell.date.getDate(),
    isToday: cell.dateStr === todayStr,
  }))
})

/**
 * État visuel d'une date : début/fin sélectionnés, ou aperçu de la fin au
 * survol tant que la seconde date n'est pas encore cliquée.
 */
function rangeState(dateStr) {
  const start = rangeStart.value
  if (!start) return {}

  const effectiveEnd = rangeEnd.value || (hoverDate.value > start ? hoverDate.value : '')

  return {
    isStart:  dateStr === start,
    isEnd:    !!effectiveEnd && dateStr === effectiveEnd,
    inRange:  !!effectiveEnd && dateStr > start && dateStr < effectiveEnd,
  }
}

function selectDay(dateStr) {
  if (!rangeStart.value || rangeEnd.value) {
    rangeStart.value = dateStr
    rangeEnd.value = ''
  } else if (dateStr < rangeStart.value) {
    rangeEnd.value = rangeStart.value
    rangeStart.value = dateStr
  } else {
    rangeEnd.value = dateStr
  }
  emit('change', { from: rangeStart.value, to: rangeEnd.value })
}

function changeMonth(delta) {
  viewDate.value = new Date(viewDate.value.getFullYear(), viewDate.value.getMonth() + delta, 1)
}

function reset() {
  rangeStart.value = ''
  rangeEnd.value = ''
  emit('change', { from: '', to: '' })
}

function toggle() {
  if (!open.value) viewDate.value = parseDateStr(rangeStart.value) ?? new Date()
  open.value = !open.value
}

function onClickOutside(event) {
  if (open.value && root.value && !root.value.contains(event.target)) open.value = false
}

function onKeydown(event) {
  if (event.key === 'Escape') open.value = false
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKeydown)
  } else {
    document.removeEventListener('mousedown', onClickOutside)
    document.removeEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onClickOutside)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="date-range">
    <BaseChip
      class="date-range__trigger"
      :active="hasRange"
      :aria-expanded="open"
      aria-haspopup="dialog"
      @click="toggle"
    >
      <span class="date-range__summary">
        <BaseIcon name="calendar" :size="15" />
        <span class="date-range__label">{{ label }}</span>
      </span>
    </BaseChip>

    <div v-if="open" class="date-range__panel" role="dialog" aria-label="Choisir une période">
      <div class="calendar__head">
        <IconButton label="Mois précédent" @click="changeMonth(-1)">
          <BaseIcon name="chevron" :size="14" class="calendar__nav-icon calendar__nav-icon--prev" />
        </IconButton>
        <BaseText size="sm" weight="semibold" color="primary">{{ monthLabel }}</BaseText>
        <IconButton label="Mois suivant" @click="changeMonth(1)">
          <BaseIcon name="chevron" :size="14" class="calendar__nav-icon" />
        </IconButton>
      </div>

      <div class="calendar__weekdays">
        <span v-for="(w, i) in WEEKDAYS" :key="i">{{ w }}</span>
      </div>

      <div class="calendar__grid" @mouseleave="hoverDate = ''">
        <CalendarDay
          v-for="cell in days"
          :key="cell.dateStr"
          :day="cell.day"
          :outside="!cell.inMonth"
          :today="cell.isToday"
          :start="rangeState(cell.dateStr).isStart"
          :end="rangeState(cell.dateStr).isEnd"
          :in-range="rangeState(cell.dateStr).inRange"
          @click="selectDay(cell.dateStr)"
          @mouseenter="hoverDate = cell.dateStr"
        />
      </div>

      <BaseButton v-if="hasRange" variant="ghost" size="sm" @click="reset">
        <BaseText size="xs" color="danger">Réinitialiser la période</BaseText>
      </BaseButton>
    </div>
  </div>
</template>

<style scoped>
.date-range {
  position: relative;
}

.date-range__summary {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  max-width: 100%;
}

.date-range__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.date-range__panel {
  position: absolute;
  z-index: 20;
  top: calc(100% + var(--space-2));
  left: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 20rem;
  max-width: 90vw;
  padding: var(--space-4);
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

/* Mobile : quelle que soit la position du bouton dans la barre de filtres
   (qui wrap), un panneau ancré à son bord gauche peut déborder de l'écran.
   On bascule en feuille fixée en bas, au-dessus de la navbar. */
@media (max-width: 640px) {
  .date-range__panel {
    position: fixed;
    z-index: 100;
    top: auto;
    left: var(--space-4);
    right: var(--space-4);
    bottom: calc(var(--navbar-height) + var(--space-4) + env(safe-area-inset-bottom));
    width: auto;
    max-width: none;
  }
}

.calendar__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Le chevron pointe à droite : « précédent » le retourne. */
.calendar__nav-icon--prev { transform: rotate(180deg); }

.calendar__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
}

.calendar__weekdays span {
  font-size: var(--text-xs);
  color: var(--color-text-muted);
}

.calendar__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

</style>
