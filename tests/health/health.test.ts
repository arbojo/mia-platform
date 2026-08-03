import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  runHealthChecks,
  getLatestHealthReport,
  resolveBusinessId,
  type HealthCheckResult,
} from '@/lib/system/health'

const BUSINESS_ID = 'b0000000-0000-4000-8000-000000000002'
const ASSISTANT_ID = 'a0000000-0000-4000-8000-000000000001'
const CHECK_CONTENT = '__health_check_roundtrip__'

function passingCheck(id: string): HealthCheckResult {
  return {
    id,
    label: id,
    status: 'passed',
    latencyMs: 10,
    origin: 'test',
    message: 'ok',
    remediation: '',
  }
}

function makeSupabaseMock(overrides: {
  businesses?: () => Promise<unknown>
  assistants?: () => Promise<unknown>
  counts?: Record<string, number>
  insertError?: boolean
  readBack?: string | null
  persistData?: { id: string; created_at: string }
  persistError?: boolean
  healthRow?: {
    id: string
    business_id: string
    scope: string
    status: string
    checks: HealthCheckResult[]
    latency_ms: number
    summary: string
    created_at: string
  }
}) {
  const fromMock = vi.fn()

  function maybeSingleResult(table: string) {
    if (table === 'businesses') {
      if (overrides.businesses) return overrides.businesses()
      return Promise.resolve({ data: { id: BUSINESS_ID }, error: null })
    }
    if (table === 'assistants') {
      if (overrides.assistants) return overrides.assistants()
      return Promise.resolve({ data: { id: ASSISTANT_ID }, error: null })
    }
    if (table === 'messages') {
      return Promise.resolve({
        data: overrides.readBack === null ? null : { content: overrides.readBack ?? CHECK_CONTENT },
        error: null,
      })
    }
    if (table === 'health_checks') {
      return Promise.resolve({
        data: overrides.healthRow ?? null,
        error: null,
      })
    }
    return Promise.resolve({ data: null, error: null })
  }

  function singleResult(table: string) {
    if (table === 'health_checks' && overrides.persistError) {
      return Promise.resolve({ data: null, error: { message: 'persist failed' } })
    }
    return Promise.resolve({
      data: overrides.persistData ?? {
        id: 'h0000000-0000-4000-8000-000000000009',
        created_at: '2026-01-01T00:00:00Z',
      },
      error: null,
    })
  }

  function chainFor(table: string) {
    let lastOp: 'select' | 'count' | 'insert' | 'delete' = 'select'

    const terminalResult = (): Promise<unknown> => {
      if (lastOp === 'count') {
        return Promise.resolve({
          count: overrides.counts?.[table] ?? 6,
          error: null,
        })
      }
      if (lastOp === 'insert') return singleResult(table)
      if (lastOp === 'delete') return Promise.resolve({ data: null, error: null })
      if (table === 'businesses') {
        if (overrides.businesses) return overrides.businesses()
        return Promise.resolve({ data: [{ id: BUSINESS_ID }], error: null })
      }
      return maybeSingleResult(table)
    }

    const chain = {
      then: (onFulfilled: (value: unknown) => unknown) =>
        terminalResult().then(onFulfilled),
      select: vi.fn((cols?: unknown, opts?: { count?: 'exact'; head?: boolean }) => {
        lastOp = opts?.count === 'exact' && opts.head ? 'count' : 'select'
        return chain
      }),
      eq: vi.fn(() => {
        if (lastOp !== 'count') lastOp = 'select'
        return chain
      }),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      insert: vi.fn(() => {
        lastOp = 'insert'
        return chain
      }),
      delete: vi.fn(() => {
        lastOp = 'delete'
        return chain
      }),
      maybeSingle: vi.fn(() => {
        lastOp = 'select'
        return maybeSingleResult(table)
      }),
      single: vi.fn(() => singleResult(table)),
    }
    return chain
  }

  fromMock.mockImplementation((table: string) => chainFor(table))
  return { from: fromMock } as unknown as { from: ReturnType<typeof vi.fn> }
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  delete process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH
})

describe('resolveBusinessId', () => {
  it('returns the provided businessId when given', async () => {
    const supabase = makeSupabaseMock({})
    const id = await resolveBusinessId(supabase as never, BUSINESS_ID)
    expect(id).toBe(BUSINESS_ID)
  })

  it('falls back to the first business when no businessId is provided', async () => {
    const supabase = makeSupabaseMock({})
    const id = await resolveBusinessId(supabase as never)
    expect(id).toBe(BUSINESS_ID)
  })
})

describe('runHealthChecks', () => {
  it('returns a passed report when all checks pass', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
    process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH = 'true'

    const supabase = makeSupabaseMock({})
    const report = await runHealthChecks({ admin: supabase as never, scope: 'precommit' })

    expect(report.status).toBe('passed')
    expect(report.checks).toHaveLength(4)
    expect(report.businessId).toBe(BUSINESS_ID)
    expect(report.summary).toContain('4/4')
  })

  it('returns failed when supabase connectivity is broken (missing env vars)', async () => {
    const supabase = makeSupabaseMock({})
    const report = await runHealthChecks({ admin: supabase as never, scope: 'precommit' })

    expect(report.status).toBe('failed')
    const connectivity = report.checks.find((c) => c.id === 'supabase_connectivity')
    expect(connectivity?.status).toBe('failed')
    expect(connectivity?.origin).toContain('src/lib/supabase/admin.ts')
  })

  it('marks vitanova_indexing failed when catalog is empty', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
    process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH = 'true'

    const supabase = makeSupabaseMock({
      counts: { products: 0, sales_rules: 0, knowledge_items: 0, ai_instructions: 0 },
    })
    const report = await runHealthChecks({ admin: supabase as never, scope: 'precommit' })

    expect(report.status).toBe('failed')
    const indexing = report.checks.find((c) => c.id === 'vitanova_indexing')
    expect(indexing?.status).toBe('failed')
    expect(indexing?.remediation).toContain('seed-vitanova.ts')
  })

  it('marks chat_persistence failed when the round-trip read does not match', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
    process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH = 'true'

    const supabase = makeSupabaseMock({ readBack: 'different-content' })
    const report = await runHealthChecks({ admin: supabase as never, scope: 'precommit' })

    expect(report.status).toBe('failed')
    const persistence = report.checks.find((c) => c.id === 'chat_persistence')
    expect(persistence?.status).toBe('failed')
    expect(persistence?.message).toContain('round-trip')
  })

  it('still returns a report when persistence insert fails', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service'
    process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH = 'true'

    const supabase = makeSupabaseMock({ persistError: true })
    const report = await runHealthChecks({ admin: supabase as never, scope: 'precommit' })

    expect(report.status).toBe('passed')
    expect(report.id).toBeUndefined()
  })
})

describe('getLatestHealthReport', () => {
  it('maps a persisted row back to a HealthReport', async () => {
    const checks = [passingCheck('supabase_connectivity')]
    const supabase = makeSupabaseMock({
      healthRow: {
        id: 'h-1',
        business_id: BUSINESS_ID,
        scope: 'dashboard',
        status: 'passed',
        checks,
        latency_ms: 15,
        summary: '1/1 checks pasaron.',
        created_at: '2026-01-01T00:00:00Z',
      },
    })

    const report = await getLatestHealthReport(supabase as never, BUSINESS_ID)
    expect(report?.id).toBe('h-1')
    expect(report?.status).toBe('passed')
    expect(report?.latencyMs).toBe(15)
    expect(report?.checks).toHaveLength(1)
  })

  it('returns null when no row exists', async () => {
    const supabase = makeSupabaseMock({})
    const report = await getLatestHealthReport(supabase as never, BUSINESS_ID)
    expect(report).toBeNull()
  })
})
