import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

/**
 * PostgREST no acepta el esquema en la ruta.
 *
 * `.from('inventory.assets')` pega a /rest/v1/inventory.assets y PostgREST
 * responde PGRST205. El esquema viaja en el header Accept-Profile, que es lo
 * que emite `.schema('inventory').from('assets')`.
 *
 * La diferencia es invisible en TypeScript: las dos formas compilan, y la
 * rota devuelve un 404 que el codigo suele ignorar porque lee `data` y ya.
 * Eso es exactamente como el purchase advisor y el seeding de onboarding
 * dejaron de escribir sin que nadie se enterara.
 *
 * Este guard es barato y cubre la clase entera, no solo los diez call sites
 * que se corrigieron a mano.
 */

const GENERATED_PATH = resolve(process.cwd(), 'src/lib/supabase/database.generated.ts')
const SRC_DIR = resolve(process.cwd(), 'src')
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx'])

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

/** Los esquemas que el generador conoce, para no hardcodear la lista. */
function knownSchemas(): string[] {
  const source = readFileSync(GENERATED_PATH, 'utf8')
  const body = source.slice(source.indexOf('export type Database = {'))
  return [...body.matchAll(/^ {2}([a-z_][a-z0-9_]*): \{$/gm)].map((m) => m[1])
}

const schemas = knownSchemas()
const nonPublicSchemas = schemas.filter((s) => s !== 'public')
const sourceFiles = walk(SRC_DIR).filter((f) => SOURCE_EXTENSIONS.has(f.slice(f.lastIndexOf('.'))))

/** `.from('algo.algo')` con cualquier forma de comillas. */
const QUALIFIED_FROM = /\.from\(\s*(['"`])(\w+)\.(\w+)\1\s*\)/g

describe('PostgREST schema access', () => {
  it('reads the schema list from the generated types', () => {
    expect(schemas).toContain('public')
    expect(nonPublicSchemas).toEqual(expect.arrayContaining(['inventory', 'delivery']))
  })

  it('scans the whole of src, so the guard is not narrower than the bug', () => {
    expect(sourceFiles.length).toBeGreaterThan(100)
  })

  it(`no source file addresses a schema inside from() (${nonPublicSchemas.join(', ')})`, () => {
    const violations: string[] = []

    for (const file of sourceFiles) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(QUALIFIED_FROM)) {
        const [, , schema, table] = match
        violations.push(
          `${relative(process.cwd(), file)}: .from('${schema}.${table}') ` +
            `-> use .schema('${schema}').from('${table}') (PGRST205)`
        )
      }
    }

    expect(violations).toEqual([])
  })

  it('reaches inventory and delivery the supported way where it does use them', () => {
    const qualified = sourceFiles.filter((f) => /from\('(inventory|delivery)\./.test(readFileSync(f, 'utf8')))
    expect(qualified).toEqual([])

    const viaSchema = sourceFiles.filter((f) => /\.schema\('(inventory|delivery)'\)/.test(readFileSync(f, 'utf8')))
    expect(viaSchema.length).toBeGreaterThan(0)
  })
})
