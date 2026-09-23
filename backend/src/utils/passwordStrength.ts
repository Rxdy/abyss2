/**
 * Robustesse d'un mot de passe, estimée par son entropie (en bits).
 *
 * Port TypeScript de `frontend/src/utils/passwordStrength.js` — MÊME algorithme,
 * volontairement dupliqué (front et API sont deux projets npm séparés, sans
 * espace de travail partagé) : les deux doivent évoluer ensemble. Toute
 * modification de l'un doit être répercutée sur l'autre — `tests/passwordStrength.test.ts`
 * reprend des vecteurs de test identiques à ceux du front pour attraper une dérive.
 *
 *   entropie ≈ (nombre de caractères « utiles ») × log2(taille de l'alphabet utilisé)
 *
 * - l'alphabet est la somme des familles présentes (minuscules 26, majuscules 26,
 *   chiffres 10, symboles 33, accents et autres caractères 30) ;
 * - un caractère ne compte pas s'il répète le précédent (aaa) ou prolonge une
 *   suite (abc, 987) ;
 * - un mot courant (azerty, password…) est retiré du calcul et ne rapporte qu'un
 *   forfait de bits : c'est ce que tenterait en premier un attaquant.
 *
 * C'est une ESTIMATION : un mot de passe tiré au hasard atteint son entropie, un
 * mot de passe choisi par un humain reste en pratique plus faible. L'échelle est
 * donc volontairement exigeante.
 */

export const PASSWORD_MIN = 8
/** bcrypt ignore tout ce qui dépasse 72 octets. */
export const PASSWORD_MAX = 72

export interface StrengthLevel {
  label: string
  minBits: number
}

/**
 * L'échelle : chaque niveau commence à `minBits`. Trois seuils repères : 28 bits
 * (moins que ça, un ordinateur de bureau le casse en quelques minutes), 60 bits
 * (hors de portée d'une attaque en ligne, même distribuée), 80 bits (aucun souci).
 */
export const STRENGTH_LEVELS: StrengthLevel[] = [
  { label: 'Très faible', minBits: 0 },
  { label: 'Faible',      minBits: 28 },
  { label: 'Moyen',       minBits: 40 },
  { label: 'Fort',        minBits: 60 },
  { label: 'Très fort',   minBits: 80 },
]

/** Entropie qui vaut 100 % : le début du dernier niveau. */
export const TARGET_BITS = STRENGTH_LEVELS.at(-1)!.minBits

/** Niveau minimum accepté à l'inscription (index dans STRENGTH_LEVELS) : « Fort ». */
export const REQUIRED_LEVEL = 3
export const REQUIRED_BITS = STRENGTH_LEVELS[REQUIRED_LEVEL].minBits
/** Le seuil requis, en pourcentage de la jauge. */
export const REQUIRED_PERCENT = Math.ceil((REQUIRED_BITS / TARGET_BITS) * 100)

/** Bits qu'on accorde à un mot courant : il est pioché dans une liste de quelques milliers. */
const COMMON_WORD_BITS = 12

const COMMON = [
  'password', 'motdepasse', 'azerty', 'azertyuiop', 'qwerty', 'qwertz', '123456', '000000',
  'abcdef', 'admin', 'abyss', 'bonjour', 'soleil', 'iloveyou', 'welcome', 'letmein',
  'monkey', 'dragon', 'football', 'marseille', 'doudou', 'chouchou', 'loulou', 'demo',
]
// Les plus longs d'abord : « azertyuiop » avant « azerty ».
const COMMON_PATTERN = new RegExp([...COMMON].sort((a, b) => b.length - a.length).join('|'), 'gi')

const ALPHABETS = [
  { test: /[a-z]/, size: 26 },
  { test: /[A-Z]/, size: 26 },
  { test: /\d/, size: 10 },
  { test: /[\x20-\x2F\x3A-\x40\x5B-\x60\x7B-\x7E]/, size: 33 }, // symboles ASCII, espace compris
  { test: /[\u0080-￿]/, size: 30 },                        // accents et autres (tout ce qui n'est pas ASCII)
]

function alphabetSize(password: string): number {
  return ALPHABETS.reduce((total, { test, size }) => total + (test.test(password) ? size : 0), 0)
}

/** Nombre de caractères qui apportent de l'information : ni répétitions, ni suites. */
function usefulLength(password: string): number {
  const chars = [...password]
  let count = 0

  chars.forEach((char, i) => {
    const previous = chars[i - 1]
    const beforePrevious = chars[i - 2]
    if (previous === undefined) { count++; return }

    if (char === previous) return // aaa

    if (beforePrevious !== undefined) {
      const step = char.codePointAt(0)! - previous.codePointAt(0)!
      const previousStep = previous.codePointAt(0)! - beforePrevious.codePointAt(0)!
      if (step === previousStep && Math.abs(step) === 1) return // abc, 321
    }
    count++
  })

  return count
}

interface Entropy {
  bits: number
  alphabet: number
  commonWords: number
  useful: number
}

/**
 * Entropie estimée, en bits. Les détails (alphabet, mots courants, longueur utile)
 * sont renvoyés pour permettre de conseiller l'utilisateur.
 */
export function estimateEntropy(password: string): Entropy {
  if (!password) return { bits: 0, alphabet: 0, commonWords: 0, useful: 0 }

  const commonWords = new Set([...password.matchAll(COMMON_PATTERN)].map((match) => match[0].toLowerCase()))
  const useful = usefulLength(password.replace(COMMON_PATTERN, ''))
  const alphabet = alphabetSize(password)

  const bits = useful * Math.log2(alphabet || 1) + commonWords.size * COMMON_WORD_BITS
  return { bits, alphabet, commonWords: commonWords.size, useful }
}

function levelFor(bits: number): number {
  let level = 0
  STRENGTH_LEVELS.forEach((candidate, index) => { if (bits >= candidate.minBits) level = index })
  return level
}

/** Un conseil concret, le plus utile d'abord. */
function adviceFor({ password, bits, alphabet, commonWords, useful, acceptable }: Entropy & { password: string; acceptable: boolean }): string {
  if (password.length < PASSWORD_MIN) return `Au moins ${PASSWORD_MIN} caractères.`
  if (password.length > PASSWORD_MAX) return `Au plus ${PASSWORD_MAX} caractères.`
  if (acceptable) return ''

  if (commonWords > 0) return 'Évitez les mots courants (azerty, password, bonjour…).'
  if (useful < password.length * 0.75) return 'Évitez les répétitions et les suites (aaa, 1234, abcd…).'

  const bitsPerChar = Math.log2(alphabet || 1)
  const extra = Math.max(1, Math.ceil((REQUIRED_BITS - bits) / bitsPerChar))
  const mixed = alphabet > 36 ? '' : ' Ou mélangez majuscules, minuscules, chiffres et symboles.'
  return `Ajoutez encore environ ${extra} caractère${extra > 1 ? 's' : ''}.${mixed}`
}

export interface StrengthEvaluation {
  /** Entropie estimée, en bits */
  bits: number
  /** 0 à 100, part de TARGET_BITS atteinte */
  percent: number
  /** index dans STRENGTH_LEVELS (null : champ vide) */
  level: number | null
  /** libellé du niveau ('' : champ vide) */
  label: string
  /** longueur permise ET niveau requis atteint */
  acceptable: boolean
  /** conseil ('' si rien à dire) */
  hint: string
}

/** Évalue un mot de passe. */
export function evaluatePassword(password: string): StrengthEvaluation {
  if (!password) return { bits: 0, percent: 0, level: null, label: '', acceptable: false, hint: '' }

  const entropy = estimateEntropy(password)
  const level = levelFor(entropy.bits)
  const inRange = password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX
  const acceptable = inRange && level >= REQUIRED_LEVEL

  return {
    bits: entropy.bits,
    percent: Math.min(100, Math.floor((entropy.bits / TARGET_BITS) * 100)),
    level,
    label: STRENGTH_LEVELS[level].label,
    acceptable,
    hint: adviceFor({ password, acceptable, ...entropy }),
  }
}

/** Message d'erreur uniforme quand un mot de passe n'atteint pas le niveau requis. */
export function weakPasswordMessage(evaluation: StrengthEvaluation): string {
  return `Mot de passe trop faible (« ${evaluation.label} », ${evaluation.percent} %) : `
    + `le niveau « ${STRENGTH_LEVELS[REQUIRED_LEVEL].label} » est requis.`
}
