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
  self.order = () => self
  self.limit = () => self
  self.single = async () => snapshotLookup
  self.maybeSingle = async () => ({ data: null })
  self.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(
      table === 'conversations'
        ? convoResponse
        : table === 'assistants'
          ? { data: [] }
          : table === 'messages'
            ? { data: null, error: { code: '42703', message: 'column conversations_1.business_id does not exist' } }
            : { data: [] }
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

import {
  analyzeConversationPatterns,
  calculateSkillLevels,
  calculateLearningVelocity,
} from '@/lib/ai/memory'
import { getProductIntelligence } from '@/lib/ai/product-intelligence'

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

  // The two queries that reach conversations through a join were the ones that
  // actually broke, because a filter on `conversations.business_id` is rejected
  // by Postgres before the join even runs. The mock rejects the messages query
  // the way PostgREST does, so this also pins that the failure is surfaced
  // instead of being flattened into "this business had no patterns".
  it('embeds conversations through assistants and surfaces a PostgREST failure', async () => {
    await expect(analyzeConversationPatterns(BIZ)).rejects.toMatchObject({
      code: '42703',
    })

    const eqs = calls.filter((c) => c.op === 'eq').map((c) => c.arg)
    expect(eqs).not.toContain('conversations.business_id')

    const select = calls.find((c) => c.op === 'select' && c.table === 'messages')
    expect(select?.arg).toContain('assistants!inner(business_id)')

    expect(calls.some((c) => c.op === 'eq' && c.arg === 'conversations.assistants.business_id')).toBe(true)
  })
})

describe('conversation tenant scoping in product intelligence', () => {
  beforeEach(() => {
    calls = []
    convoResponse = { data: [], count: 0 }
    snapshotLookup = { data: null }
    insertedSnapshots = []
  })

  // The weekly report renders from getProductIntelligence, so this query was
  // broken in exactly the same way: filtering on conversations.business_id
  // without ever embedding conversations, which PostgREST cannot resolve.
  it('embeds conversations through assistants to scope messages to the business', async () => {
    await getProductIntelligence(BIZ)

    const eqs = calls.filter((c) => c.op === 'eq').map((c) => c.arg)
    expect(eqs).not.toContain('conversations.business_id')

    const select = calls.find((c) => c.op === 'select' && c.table === 'messages')
    expect(select?.arg).toContain('conversations!inner')
    expect(select?.arg).toContain('assistants!inner(business_id)')

    expect(calls.some((c) => c.op === 'eq' && c.arg === 'conversations.assistants.business_id')).toBe(true)
  })
})
