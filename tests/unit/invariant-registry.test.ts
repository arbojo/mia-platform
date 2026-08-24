import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const registryPath = join(__dirname, '..', '..', '.governance', 'invariants.json')
const registry = JSON.parse(readFileSync(registryPath, 'utf-8')) as {
  invariants: Array<Record<string, unknown>>
}

const SCOPES = new Set(['global', 'domain', 'agent', 'loop-specific'])
const SEVERITIES = new Set(['P0', 'P1', 'P2', 'P3', 'P4'])
const STATUSES = new Set(['confirmed', 'derived', 'proposed'])
const METHODS = new Set(['automated', 'test', 'static', 'manual', 'hybrid'])
const FAILURE_BEHAVIORS = new Set(['block_complete', 'human_required', 'warn'])
const VERIFICATION_STATUSES = new Set(['covered', 'unknown'])

describe('invariant registry structure contract', () => {
  it('parses as JSON with a non-empty invariants array', () => {
    expect(Array.isArray(registry.invariants)).toBe(true)
    expect(registry.invariants.length).toBeGreaterThan(0)
  })

  it('has unique stable IDs', () => {
    const ids = registry.invariants.map((i) => i.id as string)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids)     expect(id).toMatch(/^INV-(G|D-[A-Z]+|A-[A-Z]+)-\d{3}$/)
  })

  it('uses only valid enum values', () => {
    for (const inv of registry.invariants) {
      expect(SCOPES.has(inv.scope as string), `${inv.id} scope`).toBe(true)
      expect(SEVERITIES.has(inv.severity as string), `${inv.id} severity`).toBe(true)
      expect(STATUSES.has(inv.status as string), `${inv.id} status`).toBe(true)
      expect(VERIFICATION_STATUSES.has(inv.verification_status as string), `${inv.id} verification_status`).toBe(true)
      const v = inv.verification as Record<string, unknown>
      expect(METHODS.has(v.method as string), `${inv.id} method`).toBe(true)
      expect(typeof v.evidence_required).toBe('boolean')
    }
  })

  it('requires failure_behavior and at least one source per invariant', () => {
    for (const inv of registry.invariants) {
      expect(FAILURE_BEHAVIORS.has(inv.failure_behavior as string), `${inv.id}`).toBe(true)
      const sources = inv.sources as Array<Record<string, unknown>>
      expect(Array.isArray(sources) && sources.length > 0, `${inv.id} sources`).toBe(true)
      for (const s of sources) {
        expect(typeof s.file === 'string' && s.file.length > 0, `${inv.id} source.file`).toBe(true)
        expect(typeof s.reason === 'string' && s.reason.length > 0, `${inv.id} source.reason`).toBe(true)
      }
    }
  })

  it('requires a substantive statement and a known owner role', () => {
    const owners = new Set([
      'database', 'backend', 'release', 'architect', 'orchestrator',
      'infrastructure_guardian', 'qa', 'analytics',
    ])
    for (const inv of registry.invariants) {
      expect((inv.statement as string).length, `${inv.id}`).toBeGreaterThan(30)
      expect(owners.has(inv.owner as string), `${inv.id} owner`).toBe(true)
    }
  })

  it('keeps the registry small (anti-bureaucracy bound)', () => {
    expect(registry.invariants.length).toBeLessThanOrEqual(25)
  })
})
