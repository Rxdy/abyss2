/**
 * Garde-fou d'architecture — atomic design.
 *
 * Lit le code source des composants (sans les monter) et vérifie les règles de
 * dépendance. Une régression casse la CI au lieu de se glisser dans une PR.
 *
 *   atoms      → rien (présentationnels, ne composent aucun autre composant)
 *   molecules  → atoms uniquement ; pas d'accès aux stores ni à l'API
 *   organisms  → atoms, molecules, organisms ; peuvent lire les stores
 *   layouts    → organisms, molecules, atoms
 *   pages      → tout composant, jamais une autre page ni un layout
 *
 * Et : aucun contrôle de formulaire brut (button/input/select/textarea) ni
 * <svg> hors des atoms, sauf exceptions documentées ci-dessous.
 */

import { describe, it, expect } from 'vitest'

const sources = import.meta.glob('/src/{components,layouts,pages}/**/*.vue', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** { chemin: { layer, name, template, script, imports: [{layer, name}] } } */
const files = Object.entries(sources).map(([path, code]) => {
  const rel = path.replace('/src/', '')
  const [top, sub] = rel.split('/')
  const layer = top === 'components' ? sub : top // atoms | molecules | organisms | layouts | pages
  const template = code.match(/<template>([\s\S]*)<\/template>\s*(?:<style|$)/)?.[1] ?? ''
  const script   = code.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? ''

  const imports = [...script.matchAll(/from\s+'@\/(components|layouts|pages)\/(?:(atoms|molecules|organisms)\/)?([A-Za-z]+)\.vue'/g)]
    .map(([, dir, sublayer, name]) => ({ layer: dir === 'components' ? sublayer : dir, name }))

  return { rel, layer, name: rel.split('/').pop().replace('.vue', ''), template, script, imports }
})

const inLayer = (layer) => files.filter((f) => f.layer === layer)

const ALLOWED = {
  atoms:      [],
  molecules:  ['atoms'],
  organisms:  ['atoms', 'molecules', 'organisms'],
  layouts:    ['atoms', 'molecules', 'organisms'],
  pages:      ['atoms', 'molecules', 'organisms'],
}

/**
 * Contrôles bruts tolérés hors atoms. Chaque entrée doit rester justifiée :
 * le test échoue si le fichier n'en contient plus (liste jamais périmée).
 */
const RAW_CONTROL_EXCEPTIONS = {
}

const RAW_CONTROL = /<(button|input|select|textarea)[\s>]/

describe('atomic design — structure', () => {
  it('trouve bien les composants à contrôler', () => {
    expect(files.length).toBeGreaterThan(30)
    expect(inLayer('atoms').length).toBeGreaterThanOrEqual(6)
  })

  it('range chaque composant dans atoms, molecules ou organisms', () => {
    const misplaced = files.filter((f) => !['atoms', 'molecules', 'organisms', 'layouts', 'pages'].includes(f.layer))
    expect(misplaced.map((f) => f.rel)).toEqual([])
  })
})

describe('atomic design — sens des dépendances', () => {
  for (const [layer, allowed] of Object.entries(ALLOWED)) {
    it(`${layer} n'importent que : ${allowed.join(', ') || 'aucun composant'}`, () => {
      const violations = inLayer(layer).flatMap((f) =>
        f.imports
          .filter((i) => !allowed.includes(i.layer))
          .map((i) => `${f.rel} → ${i.layer}/${i.name}`),
      )
      expect(violations).toEqual([])
    })
  }

  it('atoms et molecules restent présentationnels : ni store, ni appel API', () => {
    const violations = [...inLayer('atoms'), ...inLayer('molecules')]
      .filter((f) => /from\s+'@\/(stores|composables\/useApi)/.test(f.script))
      .map((f) => f.rel)

    expect(violations).toEqual([])
  })
})

describe('atomic design — éléments bruts', () => {
  const outsideAtoms = files.filter((f) => f.layer !== 'atoms')

  it('aucun <button>/<input>/<select>/<textarea> hors atoms, hors exceptions documentées', () => {
    const violations = outsideAtoms
      .filter((f) => RAW_CONTROL.test(f.template) && !(f.rel in RAW_CONTROL_EXCEPTIONS))
      .map((f) => f.rel)

    expect(violations).toEqual([])
  })

  it('aucune exception périmée', () => {
    const stale = Object.keys(RAW_CONTROL_EXCEPTIONS).filter((rel) => {
      const file = files.find((f) => f.rel === rel)
      return !file || !RAW_CONTROL.test(file.template)
    })

    expect(stale).toEqual([])
  })

  it('aucun <svg> hors atoms (BaseIcon, AppLogo)', () => {
    const violations = outsideAtoms.filter((f) => /<svg[\s>]/.test(f.template)).map((f) => f.rel)
    expect(violations).toEqual([])
  })
})
