/**
 * Lecture minimale de prisma/schema.prisma pour les tests de cohérence.
 *
 * Le DMMF de @prisma/client n'expose à l'exécution ni les types natifs
 * (@db.Uuid, @db.VarChar(64)…) ni les index : on lit donc le fichier lui-même,
 * ce qui est aussi la vraie « source de vérité » à comparer avec la base.
 */

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export interface PrismaField {
  name: string
  column: string
  type: string            // type Prisma : String, Int, DateTime, Boolean
  native: string | null   // Uuid, VarChar, Text, Date, Timestamptz…
  length: number | null   // VarChar(64) → 64
  optional: boolean
  hasDefault: boolean
  unique: boolean
}

export interface PrismaRelation {
  field: string
  target: string          // modèle visé
  fromColumn: string
  onDelete: string | null // Cascade | SetNull | …
}

export interface PrismaModel {
  name: string
  table: string
  fields: PrismaField[]
  relations: PrismaRelation[]
  indexes: { columns: string[]; unique: boolean }[]
}

const SCALARS = new Set(['String', 'Int', 'DateTime', 'Boolean'])

export function schemaPath() {
  return [resolve(process.cwd(), 'prisma/schema.prisma'), '/app/prisma/schema.prisma'].find(existsSync)!
}

export function parseSchema(source = readFileSync(schemaPath(), 'utf8')): PrismaModel[] {
  const models: PrismaModel[] = []

  for (const [, name, body] of source.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const lines = body.split('\n').map((l) => l.replace(/\/\/.*$/, '').trim()).filter(Boolean)

    const columnOf = new Map<string, string>()
    const fields: PrismaField[] = []
    const relations: PrismaRelation[] = []
    const rawIndexes: string[][] = []
    let table = name

    for (const line of lines) {
      if (line.startsWith('@@map')) { table = /@@map\("([^"]+)"\)/.exec(line)![1]; continue }
      if (line.startsWith('@@index')) { rawIndexes.push(/\[([^\]]+)\]/.exec(line)![1].split(',').map((c) => c.trim())); continue }
      if (line.startsWith('@@')) continue

      const match = /^(\w+)\s+(\w+)(\?|\[\])?\s*(.*)$/.exec(line)
      if (!match) continue
      const [, field, type, modifier, attrs] = match

      if (SCALARS.has(type)) {
        const native = /@db\.(\w+)(?:\(([^)]*)\))?/.exec(attrs)
        const column = /@map\("([^"]+)"\)/.exec(attrs)?.[1] ?? field
        columnOf.set(field, column)
        fields.push({
          name: field,
          column,
          type,
          native: native?.[1] ?? null,
          length: native?.[2] ? Number(native[2]) : null,
          optional: modifier === '?',
          hasDefault: /@default\(/.test(attrs) || /@updatedAt/.test(attrs),
          unique: /@unique\b/.test(attrs),
        })
      } else if (/@relation\(/.test(attrs) && /fields:/.test(attrs)) {
        relations.push({
          field,
          target: type,
          fromColumn: /fields:\s*\[(\w+)\]/.exec(attrs)![1],   // nom du champ, converti plus bas
          onDelete: /onDelete:\s*(\w+)/.exec(attrs)?.[1] ?? null,
        })
      }
    }

    models.push({
      name,
      table,
      fields,
      relations: relations.map((r) => ({ ...r, fromColumn: columnOf.get(r.fromColumn) ?? r.fromColumn })),
      indexes: rawIndexes.map((cols) => ({ columns: cols.map((c) => columnOf.get(c) ?? c), unique: false })),
    })
  }

  return models
}
