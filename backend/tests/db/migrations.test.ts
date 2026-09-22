/**
 * Migrations Prisma : la base réelle correspond exactement à `prisma/migrations`,
 * et les rejouer (déploiement idempotent) ne modifie rien.
 *
 * Remplace l'ancien test de rejeu d'`postgres/init.sql` (migrations versionnées
 * adoptées — voir todo.md) : `prisma migrate deploy` est le nouveau mécanisme,
 * et il doit avoir exactement la même propriété d'idempotence que l'ancien script.
 */

import { describe, it, expect, afterAll } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { prisma } from './helpers.js'

const run = promisify(execFile)

afterAll(() => prisma.$disconnect())

/** Empreinte de la structure produite par les migrations. */
async function structureSnapshot() {
  const columns = await prisma.$queryRaw<{ s: string }[]>`
    SELECT table_name || '.' || column_name || ':' || data_type || ':' || is_nullable || ':' || COALESCE(column_default, '') AS s
    FROM information_schema.columns WHERE table_schema = 'dbo' ORDER BY 1`
  const constraints = await prisma.$queryRaw<{ s: string }[]>`
    SELECT conrelid::regclass || '.' || conname || ':' || pg_get_constraintdef(oid) AS s
    FROM pg_constraint WHERE connamespace = 'dbo'::regnamespace ORDER BY 1`
  const indexes = await prisma.$queryRaw<{ s: string }[]>`
    SELECT indexname || ':' || indexdef AS s FROM pg_indexes WHERE schemaname = 'dbo' ORDER BY 1`
  const triggers = await prisma.$queryRaw<{ s: string }[]>`
    SELECT tgrelid::regclass || '.' || tgname AS s FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid WHERE c.relnamespace = 'dbo'::regnamespace AND NOT t.tgisinternal ORDER BY 1`

  return { columns, constraints, indexes, triggers }
}

/** Dossier de migrations, quel que soit l'endroit d'où les tests tournent (CI, conteneur). */
const MIGRATIONS_DIR = [
  resolve(process.cwd(), 'prisma/migrations'), // conteneur de l'API, poste local
  '/app/prisma/migrations',
].find(existsSync)

describe('prisma/migrations', () => {
  it('existe et contient au moins une migration', () => {
    expect(MIGRATIONS_DIR, 'dossier de migrations introuvable').toBeDefined()
    const entries = readdirSync(MIGRATIONS_DIR!).filter((name) => name !== 'migration_lock.toml')
    expect(entries.length).toBeGreaterThan(0)
  })

  it('la base est à jour : aucune migration en attente, aucune dérive détectée par Prisma', async () => {
    const { stdout } = await run('npx', ['prisma', 'migrate', 'status'])

    expect(stdout).toContain('Database schema is up to date!')
  })

  it('« migrate deploy » est un no-op sur une base déjà à jour (idempotent, comme l\'était init.sql)', async () => {
    const before = await structureSnapshot()

    const { stdout } = await run('npx', ['prisma', 'migrate', 'deploy'])
    expect(stdout).toContain('No pending migrations to apply.')

    const after = await structureSnapshot()

    // Différences lisibles : « - avant » / « + après »
    const changes = (key: keyof typeof before) => {
      const a = before[key].map((r) => r.s)
      const b = after[key].map((r) => r.s)
      return [...a.filter((x) => !b.includes(x)).map((x) => `- ${x}`), ...b.filter((x) => !a.includes(x)).map((x) => `+ ${x}`)]
    }

    expect(changes('columns')).toEqual([])
    expect(changes('constraints')).toEqual([])
    expect(changes('indexes')).toEqual([])
    expect(changes('triggers')).toEqual([])
  })
})
