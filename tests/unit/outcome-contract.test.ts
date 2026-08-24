import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = join(__dirname, '..', '..')
const migrationsDir = join(repoRoot, 'supabase', 'migrations')
const typesSource = readFileSync(join(repoRoot, 'src', 'lib', 'types', 'index.ts'), 'utf-8')

function extractOutcomeCheckValues(sql: string): string[] {
  const match = sql.match(/CHECK \(outcome IN \(([^)]+)\)\)/)
  if (!match) return []
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

function extractTypesUnionValues(source: string): string[] {
  const values = new Set<string>()
  for (const line of source.split('\n')) {
    if (!/(^|\s)outcome\??\s*:/.test(line) || !line.includes("'")) continue
    for (const m of line.matchAll(/'([^']+)'/g)) values.add(m[1])
    if (/null/.test(line)) values.add('null')
  }
  return [...values]
}

describe('conversations.outcome schema/type contract', () => {
  it('migration 025 CHECK matches the application TypeScript union', () => {
    const migration025 = readFileSync(join(migrationsDir, '025_sales_events.sql'), 'utf-8')
    const dbValues = extractOutcomeCheckValues(migration025)
    expect(dbValues.length).toBeGreaterThan(0)

    const typeValues = extractTypesUnionValues(typesSource).filter((v) => v !== 'null')
    expect(new Set(typeValues)).toEqual(new Set(dbValues))
  })

  it('no later migration reintroduces a divergent conversations.outcome CHECK', () => {
    const checks = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql') && f >= '025_sales_events.sql')
      .sort()
      .map((f) => ({ file: f, values: extractOutcomeCheckValues(readFileSync(join(migrationsDir, f), 'utf-8')) }))
      .filter((c) => c.values.length > 0)

    expect(checks.length).toBeGreaterThanOrEqual(1)
    const first = new Set(checks[0].values)
    for (const check of checks.slice(1)) {
      expect(new Set(check.values), `divergent outcome CHECK in ${check.file}`).toEqual(first)
    }
  })

  it("'cancelled' is not an accepted outcome anywhere in the contract", () => {
    expect(extractTypesUnionValues(typesSource)).not.toContain('cancelled')
    for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql'))) {
      const sql = readFileSync(join(migrationsDir, file), 'utf-8')
      if (/CHECK \(outcome IN /.test(sql)) {
        expect(extractOutcomeCheckValues(sql), file).not.toContain('cancelled')
      }
    }
  })
})
