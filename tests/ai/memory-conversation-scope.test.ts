import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * `conversations` has no `business_id` column: tenant scope lives on
 * `assistants`, reached through `conversations.assistant_id`. The learning
 * pipeline used to filter conversations by `business_id`, which is Postgres
 * 42703 (undefined_column). It shipped because the cron test mocks this whole
 * module, so nothing ever built a query against the real table.
 *
 * These tests pin the shape of the query instead of the result.
 */

type Call = { table: string; op: 'eq' | 'in' | 'gte' | 'select'; arg: unknown }

const originalEnv = process.env.SUPABASE_SERVICE_ROLE_KEY

let calls: Call[]
let convoResponse: { data: unknown[]; count: number | null }
let snapshotLookup: { data: unknown }
let insertedSnapshots: unknown[]

function chain(table: string) {
  const self: Record<string, unknown> = {}
  const record = (op: Call['op']) => (arg: unknown) => {
    calls.push({ table, op, arg })
    return self
  }
  self.select = (arg: unknown) => {
    calls.push({ table, op: 'select', arg })
    return self
  }
  self.eq = record('eq')
  self.in = record('in')
  self.gte = record('gte')
  self.lte = record('gte')
  self.single = async () => snapshotLookup
  self.maybeSingle = async () => ({ data: null })
  self.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(
      table === 'conversations' ? convoResponse : table === 'assistants' ? { data: [] } : { data: [] }
    ).then(resolve)
  return self
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const c = chain(table)
      c.insert = (arg: unknown) => {
        insertedSnapshots.push(arg)
        return c
      }
      c.update = () => c
      c.upsert = () => c
      return c
    },
  }),
}))

vi.mock('@/lib/runtime/execute-ai', () => ({
  executeAI: vi.fn(),
}))

import { calculateSkillLevels, calculateLearningVelocity } from '@/lib/ai/memory'

const BIZ = 'b1111111-1111-1111-1111-111111111111'

beforeEach(() => {
  calls = []
  convoResponse = { data: [{ id: 'c1' }], count: 1 }
  snapshotLookup = { data: null }
  insertedSnapshots = []
  process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv ?? 'test-service-role'
})

function filtersFor(table: string) {
  return calls.filter((c) => c.table === table)
}

describe('conversation tenant scoping in the learning pipeline', () => {
  it('scopes calculateSkillLevels conversations by assistant_id, never by business_id', async () => {
    await calculateSkillLevels(BIZ)

    const convo = filtersFor('conversations')
    expect(convo.length).toBeGreaterThan(0)

    const businessIdFilters = convo.filter(
      (c) => (c.op === 'eq' || c.op === 'in') && c.arg === 'business_id'
    )
    expect(businessIdFilters).toEqual([])

    expect(convo.some((c) => c.op === 'in' && c.arg === 'assistant_id')).toBe(true)
  })

  it('resolves the business assistants before touching conversations', async () => {
    await calculateSkillLevels(BIZ)

    const firstConvo = calls.findIndex((c) => c.table === 'conversations')
    const assistants = calls.findIndex((c) => c.table === 'assistants')
    expect(assistants).toBeGreaterThanOrEqual(0)
    expect(assistants).toBeLessThan(firstConvo)
    expect(filtersFor('assistants').some((c) => c.op === 'eq' && c.arg === 'business_id')).toBe(true)
  })

  it('scopes calculateLearningVelocity conversations by assistant_id, never by business_id', async () => {
    await calculateLearningVelocity(BIZ)

    const convo = filtersFor('conversations')
    const businessIdFilters = convo.filter(
      (c) => (c.op === 'eq' || c.op === 'in') && c.arg === 'business_id'
    )
    expect(businessIdFilters).toEqual([])
    expect(convo.some((c) => c.op === 'in' && c.arg === 'assistant_id')).toBe(true)
  })

  it('never filters any conversations query by a column the table lacks', async () => {
    await calculateSkillLevels(BIZ)
    await calculateLearningVelocity(BIZ)

    // conversations columns, per 001_initial_schema.sql
    const real = new Set([
      'id',
      'assistant_id',
      'customer_id',
      'type',
      'status',
      'assigned_to',
      'handover_reason',
      'created_at',
    ])

    const bogus = calls
      .filter((c) => c.table === 'conversations')
      .filter((c) => c.op === 'eq' || c.op === 'in')
      .map((c) => c.arg)
      .filter((col): col is string => typeof col === 'string' && !real.has(col))

    expect(bogus).toEqual([])
  })
})
