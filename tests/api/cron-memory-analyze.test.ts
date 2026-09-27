import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FAKE_UUIDS } from '../fixtures'

const originalEnv = process.env.MIA_CRON_SECRET
const originalCronSecret = process.env.CRON_SECRET
beforeEach(() => {
  process.env.MIA_CRON_SECRET = 'test-cron-secret-12345'
  process.env.CRON_SECRET = 'test-scheduler-secret-67890'
})

afterEach(() => {
  process.env.MIA_CRON_SECRET = originalEnv
  process.env.CRON_SECRET = originalCronSecret
})

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      ok: (init?.status ?? 200) < 400,
      body,
      async json() {
        return body
      },
    }),
  },
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/ai/memory', () => ({
  analyzeConversationPatterns: vi.fn(),
  upsertBusinessMemory: vi.fn(),
  calculateSkillLevels: vi.fn(),
  calculateLearningVelocity: vi.fn(),
}))

import { GET, POST } from '@/app/api/cron/memory-analyze/route'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  analyzeConversationPatterns,
  upsertBusinessMemory,
  calculateSkillLevels,
  calculateLearningVelocity,
} from '@/lib/ai/memory'

const mockedCreateAdminClient = vi.mocked(createAdminClient)
const mockedAnalyze = vi.mocked(analyzeConversationPatterns)
const mockedUpsertMemory = vi.mocked(upsertBusinessMemory)
const mockedSkills = vi.mocked(calculateSkillLevels)
const mockedVelocity = vi.mocked(calculateLearningVelocity)

function mockSingleBusinessAdmin() {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(() =>
            Promise.resolve({ data: { id: FAKE_UUIDS.business }, error: null })
          ),
        })),
      })),
    })),
  }
}

function mockListBusinessesAdmin(businessIds: string[]) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => Promise.resolve({ data: businessIds.map((id) => ({ id })), error: null })),
    })),
  }
}

function mockLearningSuccess() {
  mockedAnalyze.mockResolvedValue([
    {
      memory_type: 'pattern',
      category: 'pricing_question',
      content: 'Los clientes preguntan el precio antes que el envío',
      evidence: { count: 3, examples: ['cuanto cuesta', 'precio'] },
      confidence: 80,
    },
  ])
  mockedUpsertMemory.mockResolvedValue([{ id: 'mem1' }] as never)
  mockedSkills.mockResolvedValue([{ skill_key: 'objection_handling' }] as never)
  mockedVelocity.mockResolvedValue({
    period: 'weekly',
    period_start: '2026-09-21',
    period_end: '2026-09-27',
    new_facts: 1,
    new_products: 0,
    new_rules: 0,
    new_faqs: 0,
    preparation_delta: 0,
    confidence_delta: 0,
    conversations_analyzed: 12,
    opportunities_found: 1,
  } as never)
}

describe('POST /api/cron/memory-analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when cron secret header is missing', async () => {
    const request = new Request('http://localhost/api/cron/memory-analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const res = await POST(request)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when cron secret is invalid', async () => {
    const request = new Request('http://localhost/api/cron/memory-analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mia-cron-secret': 'wrong-secret',
      },
      body: JSON.stringify({}),
    })

    const res = await POST(request)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('accepts the Vercel scheduler Authorization Bearer header', async () => {
    mockedCreateAdminClient.mockReturnValue(mockListBusinessesAdmin([]) as never)
    mockLearningSuccess()

    const request = new Request('http://localhost/api/cron/memory-analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-scheduler-secret-67890',
      },
      body: JSON.stringify({}),
    })

    const res = await POST(request)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('completed')
  })

  it('rejects Authorization with an unknown scheduler secret', async () => {
    const request = new Request('http://localhost/api/cron/memory-analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer wrong-secret',
      },
      body: JSON.stringify({}),
    })

    const res = await POST(request)
    expect(res.status).toBe(401)
  })

  it('returns 404 when business does not exist', async () => {
    mockedCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
    } as never)

    const request = new Request('http://localhost/api/cron/memory-analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mia-cron-secret': 'test-cron-secret-12345',
      },
      body: JSON.stringify({ business_id: FAKE_UUIDS.business }),
    })

    const res = await POST(request)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Business not found')
  })

  it('runs the learning pipeline for a single business', async () => {
    mockedCreateAdminClient.mockReturnValue(mockSingleBusinessAdmin() as never)
    mockLearningSuccess()

    const request = new Request('http://localhost/api/cron/memory-analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mia-cron-secret': 'test-cron-secret-12345',
      },
      body: JSON.stringify({ business_id: FAKE_UUIDS.business }),
    })

    const res = await POST(request)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('completed')
    expect(body.businesses_processed).toBe(1)
    expect(mockedAnalyze).toHaveBeenCalledWith(FAKE_UUIDS.business)
    expect(mockedUpsertMemory).toHaveBeenCalledTimes(1)
    expect(mockedSkills).toHaveBeenCalledWith(FAKE_UUIDS.business)
    expect(mockedVelocity).toHaveBeenCalledWith(FAKE_UUIDS.business)
  })

  it('iterates all businesses when no business_id is provided', async () => {
    const ids = [FAKE_UUIDS.business, '00000000-0000-0000-0000-000000000002']
    mockedCreateAdminClient.mockReturnValue(mockListBusinessesAdmin(ids) as never)
    mockLearningSuccess()

    const request = new Request('http://localhost/api/cron/memory-analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mia-cron-secret': 'test-cron-secret-12345',
      },
      body: JSON.stringify({}),
    })

    const res = await POST(request)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.businesses_processed).toBe(2)
    expect(body.businesses_failed).toBe(0)
    expect(mockedAnalyze).toHaveBeenCalledTimes(2)
  })

  it('captures per-business failures without aborting the run', async () => {
    const ids = [FAKE_UUIDS.business, '00000000-0000-0000-0000-000000000002']
    mockedCreateAdminClient.mockReturnValue(mockListBusinessesAdmin(ids) as never)
    mockedAnalyze
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('Database error'))
    mockedSkills.mockResolvedValue([])
    mockedVelocity.mockResolvedValue({
      new_facts: 0,
    } as never)

    const request = new Request('http://localhost/api/cron/memory-analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mia-cron-secret': 'test-cron-secret-12345',
      },
      body: JSON.stringify({}),
    })

    const res = await POST(request)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.businesses_processed).toBe(2)
    expect(body.businesses_failed).toBe(1)
    const failed = body.businesses.find((b: { status: string }) => b.status === 'failed')
    expect(failed.business_id).toBe(ids[1])
  })
})

describe('GET /api/cron/memory-analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Vercel Cron only ever issues a GET. A route that exports POST alone stays
  // listed as an active schedule in the dashboard while every run 405s, so the
  // scheduler silently stops feeding the learning pipeline with no visible
  // failure anywhere.
  it('is reachable with GET, which is the only verb Vercel Cron uses', async () => {
    mockedCreateAdminClient.mockReturnValue(mockListBusinessesAdmin([]) as never)
    mockLearningSuccess()

    const request = new Request('http://localhost/api/cron/memory-analyze', {
      method: 'GET',
      headers: { Authorization: 'Bearer test-scheduler-secret-67890' },
    })

    const res = await GET(request)
    expect(res.status).toBe(200)
  })

  it('runs every business when the scheduler sends no query string', async () => {
    const ids = [FAKE_UUIDS.business, '00000000-0000-0000-0000-000000000002']
    mockedCreateAdminClient.mockReturnValue(mockListBusinessesAdmin(ids) as never)
    mockLearningSuccess()

    const request = new Request('http://localhost/api/cron/memory-analyze', {
      method: 'GET',
      headers: { 'x-mia-cron-secret': 'test-cron-secret-12345' },
    })

    const res = await GET(request)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.businesses_processed).toBe(2)
    expect(mockedAnalyze).toHaveBeenCalledTimes(2)
  })

  it('scopes to one business via the business_id query param', async () => {
    mockedCreateAdminClient.mockReturnValue(mockSingleBusinessAdmin() as never)
    mockLearningSuccess()

    const request = new Request(
      `http://localhost/api/cron/memory-analyze?business_id=${FAKE_UUIDS.business}`,
      { method: 'GET', headers: { 'x-mia-cron-secret': 'test-cron-secret-12345' } }
    )

    const res = await GET(request)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.businesses_processed).toBe(1)
    expect(mockedAnalyze).toHaveBeenCalledWith(FAKE_UUIDS.business)
  })

  it('still rejects an unauthenticated GET', async () => {
    const request = new Request('http://localhost/api/cron/memory-analyze', { method: 'GET' })

    const res = await GET(request)
    expect(res.status).toBe(401)
  })

  // PostgREST rejects with a plain object, not an Error. An `instanceof Error`
  // check reported "Unknown error" for every tenant while the real cause only
  // existed in the server logs, which is how a missing conversations column
  // failed silently on all five businesses every night.
  it('surfaces the real message when a PostgREST-shaped error is thrown', async () => {
    mockedCreateAdminClient.mockReturnValue(mockSingleBusinessAdmin() as never)
    mockedAnalyze.mockResolvedValue([])
    mockedUpsertMemory.mockResolvedValue([])
    mockedVelocity.mockResolvedValue({
      period: 'weekly',
      period_start: '2026-08-24',
      period_end: '2026-08-30',
      new_facts: 0,
      new_products: 0,
      new_rules: 0,
      new_faqs: 0,
      preparation_delta: 0,
      confidence_delta: 0,
      conversations_analyzed: 0,
      opportunities_found: 0,
    } as never)
    mockedSkills.mockRejectedValue({
      code: '42703',
      details: null,
      hint: null,
      message: 'column conversations_1.business_id does not exist',
    })

    const request = new Request(
      `http://localhost/api/cron/memory-analyze?business_id=${FAKE_UUIDS.business}`,
      { method: 'GET', headers: { 'x-mia-cron-secret': 'test-cron-secret-12345' } }
    )

    const res = await GET(request)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.businesses_failed).toBe(1)
    const failure = body.businesses[0]
    expect(failure.status).toBe('failed')
    expect(failure.error).toBe('42703: column conversations_1.business_id does not exist')
  })
})