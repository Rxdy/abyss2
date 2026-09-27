/**
 * Garde-fou de lisibilité — contraste WCAG AA des couleurs du thème.
 *
 * Lit les jetons de src/assets/styles/_variables.css (thème sombre et clair) et
 * vérifie les associations texte / fond réellement utilisées dans l'app :
 * 4,5:1 pour du texte, 3:1 pour un élément d'interface (anneau de focus).
 * Changer une couleur qui rend un texte illisible fait échouer la CI.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Lu directement : Vitest vide les imports CSS par défaut
const css = readFileSync(join(process.cwd(), 'src/assets/styles/_variables.css'), 'utf8')

/** Jetons `--color-*` d'un bloc CSS. */
function tokens(selector) {
  const start = css.indexOf(`${selector} {`)
  const body  = css.slice(start, css.indexOf('\n}\n', start))
  return Object.fromEntries([...body.matchAll(/--color-([\w-]+):\s*([^;]+);/g)].map(([, k, v]) => [k, v.trim()]))
}

const dark  = tokens(':root')
const light = { ...dark, ...tokens('[data-theme="light"]') }

function parse(value) {
  if (value.startsWith('#')) {
    const hex = value.slice(1)
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)).concat(1)
  }
  const [r, g, b, a = 1] = value.match(/rgba?\(([^)]+)\)/)[1].split(',').map(Number)
  return [r, g, b, a]
}

const over = ([r, g, b, a], [br, bg, bb]) => [r * a + br * (1 - a), g * a + bg * (1 - a), b * a + bb * (1 - a), 1]

/** Couleur opaque d'un jeton, composée sur `base` si elle est translucide. */
function solid(theme, name, base = 'bg-base') {
  const color = parse(theme[name])
  return color[3] < 1 ? over(color, solid(theme, base)) : color
}

function luminance([r, g, b]) {
  const channel = (v) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** [libellé, premier plan, arrière-plan, minimum] — `x@y` = jeton translucide x posé sur y. */
const PAIRS = [
  ['texte principal sur fond',            'text-primary',   'bg-base',                 4.5],
  ['texte principal sur carte',           'text-primary',   'bg-surface',              4.5],
  ['texte secondaire sur carte',          'text-secondary', 'bg-surface',              4.5],
  ['texte secondaire sur fond',           'text-secondary', 'bg-base',                 4.5],
  ['texte atténué sur carte',             'text-muted',     'bg-surface',              4.5],
  ['texte atténué sur fond',              'text-muted',     'bg-base',                 4.5],
  ['texte atténué sur champ de saisie',   'text-muted',     'bg-elevated',             4.5],
  ['bleu primaire sur fond (liens)',      'primary',        'bg-base',                 4.5],
  ['bleu primaire sur carte',             'primary',        'bg-surface',              4.5],
  ['bleu primaire sur sa teinte (actif)', 'primary',        'primary-subtle@bg-surface', 4.5],
  ['texte sur bouton primaire',           'text-inverse',   'primary',                 4.5],
  ['texte sur bouton primaire (survol)',  'text-inverse',   'primary-hover',           4.5],
  ['menthe accent sur fond (liens)',      'accent',         'bg-base',                 4.5],
  ['menthe accent sur carte',             'accent',         'bg-surface',              4.5],
  ['texte sur bouton accent',             'text-inverse',   'accent',                  4.5],
  ['texte sur bouton accent (survol)',    'text-inverse',   'accent-hover',            4.5],
  ['succès sur carte (montants +)',       'success',        'bg-surface',              4.5],
  ['danger sur carte (montants −)',       'danger',         'bg-surface',              4.5],
  ['danger sur alerte',                   'danger',         'danger-subtle@bg-base',   4.5],
  ['avertissement sur carte',             'warning',        'bg-surface',              4.5],
  ['avertissement sur bannière',          'warning',        'warning-subtle@bg-base',  4.5],
  ['texte sur bouton danger (survol)',    'text-inverse',   'danger',                  4.5],
  ['anneau de focus sur fond (UI)',       'border-focus',   'bg-base',                 3.0],
]

function resolve(theme, ref) {
  if (!ref.includes('@')) return solid(theme, ref)
  const [name, base] = ref.split('@')
  return over(parse(theme[name]), solid(theme, base))
}

for (const [themeName, theme] of [['sombre', dark], ['clair', light]]) {
  describe(`contraste WCAG AA — thème ${themeName}`, () => {
    it.each(PAIRS)('%s', (_label, fg, bg, minimum) => {
      const background = resolve(theme, bg)
      let foreground = resolve(theme, fg)
      if (foreground[3] < 1) foreground = over(foreground, background)

      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(minimum)
    })
  })
}

describe('jetons de thème', () => {
  it('le thème clair redéfinit chaque couleur sémantique (pas d\'héritage du sombre)', () => {
    const lightOnly = tokens('[data-theme="light"]')

    for (const name of ['primary', 'accent', 'success', 'warning', 'danger', 'text-primary', 'text-muted', 'bg-base']) {
      expect(lightOnly, name).toHaveProperty(name)
    }
  })
})

/* ── Échelle de robustesse des mots de passe (--strength-0 … 4) ─────────── */

/** Jetons `--strength-*` d'un bloc CSS. */
function strengthTokens(selector) {
  const start = css.indexOf(`${selector} {`)
  const body  = css.slice(start, css.indexOf('\n}\n', start))
  return [0, 1, 2, 3, 4].map((n) => parse(body.match(new RegExp(`--strength-${n}:\\s*([^;]+);`))[1].trim()))
}

const STRENGTH = {
  sombre: { colors: strengthTokens(':root'),               theme: dark },
  clair:  { colors: strengthTokens('[data-theme="light"]'), theme: light },
}

describe('échelle de robustesse — couleurs', () => {
  for (const [name, { colors, theme }] of Object.entries(STRENGTH)) {
    it.each([0, 1, 2, 3, 4])(`thème ${name} : niveau %i lisible sur une carte (3:1, élément graphique)`, (level) => {
      expect(contrast(colors[level], solid(theme, 'bg-surface'))).toBeGreaterThanOrEqual(3)
    })

    it(`thème ${name} : deux niveaux voisins ne se confondent pas`, () => {
      const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
      for (let level = 0; level < 4; level++) {
        expect(distance(colors[level], colors[level + 1]), `${level} → ${level + 1}`).toBeGreaterThan(60)
      }
    })
  }

  it('le thème clair a bien ses propres teintes (plus sombres que le thème sombre)', () => {
    for (let level = 0; level < 5; level++) {
      expect(luminance(STRENGTH.clair.colors[level])).toBeLessThan(luminance(STRENGTH.sombre.colors[level]))
    }
  })
})

describe('_variables.css — validité', () => {
  it('se minifie sans erreur (attrape les déclarations tombées hors de tout sélecteur, par ex. dans un bloc @media)', async () => {
    const { transform } = await import('lightningcss')

    expect(() => transform({ filename: '_variables.css', code: Buffer.from(css), minify: true })).not.toThrow()
  })
})
