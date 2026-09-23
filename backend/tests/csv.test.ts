/**
 * Tests unitaires — sérialisation CSV de l'export
 */

import { describe, it, expect } from 'vitest'
import { csvCell, toCsv, centsToDecimal } from '../src/utils/csv.js'

describe('csvCell', () => {
  it('laisse une valeur simple telle quelle', () => {
    expect(csvCell('Courses')).toBe('Courses')
    expect(csvCell(42)).toBe('42')
  })

  it('renvoie une cellule vide pour null et undefined', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })

  it('met entre guillemets les virgules, guillemets et retours à la ligne', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('il dit "oui"')).toBe('"il dit ""oui"""')
    expect(csvCell('ligne 1\nligne 2')).toBe('"ligne 1\nligne 2"')
  })

  it.each(['=SUM(A1:A9)', '+33 6 12 34 56 78', '-2+3', '@cmd', '\tx', '\rx'])(
    'neutralise une cellule qui commencerait une formule : %j',
    (value) => {
      expect(csvCell(value).replace(/^"/, '').startsWith("'")).toBe(true)
    },
  )

  it('neutralise puis échappe quand la formule contient aussi une virgule', () => {
    expect(csvCell('=A1,B1')).toBe('"\'=A1,B1"')
  })
})

describe('toCsv', () => {
  it('écrit un BOM, l\'en-tête puis les lignes en CRLF', () => {
    const csv = toCsv(['a', 'b'], [[1, 'x'], [2, null]])
    expect(csv).toBe('﻿a,b\r\n1,x\r\n2,\r\n')
  })

  it('sans ligne : l\'en-tête seul', () => {
    expect(toCsv(['a'], [])).toBe('﻿a\r\n')
  })
})

describe('centsToDecimal', () => {
  it.each([[0, '0.00'], [5, '0.05'], [1234, '12.34'], [100000, '1000.00']])(
    '%i centimes → %s',
    (cents, expected) => expect(centsToDecimal(cents)).toBe(expected),
  )
})
