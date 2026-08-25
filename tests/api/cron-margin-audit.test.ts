import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FAKE_UUIDS } from '../fixtures'

// Mock environment variables
const originalEnv = process.env.MIA_CRON_SECRET
beforeEach(() => {
  process.env.MIA_CRON_SECRET = 'test-cron-secret-12345'
})

afterEach(() => {
  process.env.MIA_CRON_SECRET = originalEnv
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

vi.mock('@/lib/analytics/margin-audit', () => ({
  runMarginAudit: vi.fn(),
}))

import { POST, GET } from '@/app/api/cron/margin-audit/route'
import { createAdminClient } from '@/lib/supabase/admin'
import { runMarginAudit } from '@/lib/analytics/margin-audit'

const mockedCreateAdminClient = vi.mocked(createAdminClient)
const mockedRunMarginAudit = vi.mocked(runMarginAudit)

describe('POST /api/cron/margin-audit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when cron secret header is missing', async () => {
    const request = new Request('http://localhost/api/cron/margin-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_id: FAKE_UUIDS.business }),
    })

    const res = await POST(request)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 when cron secret is invalid', async () => {
    const request = new Request('http://localhost/api/cron/margin-audit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mia-cron-secret': 'wrong-secret',
      },
      body: JSON.stringify({ business_id: FAKE_UUIDS.business }),
    })

    const res = await POST(request)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 400 when business_id is missing from body', async () => {
    const request = new Request('http://localhost/api/cron/margin-audit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mia-cron-secret': 'test-cron-secret-12345',
      },
      body: JSON.stringify({}),
    })

    const res = await POST(request)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('business_id required')
  })

  it('returns 404 when business does not exist', async () => {
    const mockAdmin = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() =>
              Promise.resolve({ data: null, error: null })
            ),
          })),
        })),
      })),
    }

    mockedCreateAdminClient.mockReturnValue(mockAdmin as never)

    const request = new Request('http://localhost/api/cron/margin-audit', {
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

  it('returns 200 with audit results when valid secret and business', async () => {
    const mockAdmin = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() =>
              Promise.resolve({
                data: { id: FAKE_UUIDS.business },
                error: null,
              })
            ),
          })),
        })),
      })),
    }

    mockedCreateAdminClient.mockReturnValue(mockAdmin as never)
    mockedRunMarginAudit.mockResolvedValue({
      margins: [
        {
          product_id: 'p1',
          product_name: 'Widget',
          revenue: 1000,
          cogs: 600,
          delivery_cost: 50,
          gross_margin: 350,
          gross_margin_pct: 35,
          units_sold: 10,
        },
      ],
      anomalies: [],
      insights_created: 1,
    } as never)

    const request = new Request('http://localhost/api/cron/margin-audit', {
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
    expect(body.margins_count).toBe(1)
    expect(body.anomalies_count).toBe(0)
    expect(body.insights_created).toBe(1)
    expect(mockedRunMarginAudit).toHaveBeenCalledWith(FAKE_UUIDS.business)
  })

  it('returns 500 when margin audit fails', async () => {
    const mockAdmin = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() =>
              Promise.resolve({
                data: { id: FAKE_UUIDS.business },
                error: null,
              })
            ),
          })),
        })),
      })),
    }

    mockedCreateAdminClient.mockReturnValue(mockAdmin as never)
    mockedRunMarginAudit.mockRejectedValue(new Error('Database error'))

    const request = new Request('http://localhost/api/cron/margin-audit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mia-cron-secret': 'test-cron-secret-12345',
      },
      body: JSON.stringify({ business_id: FAKE_UUIDS.business }),
    })

    const res = await POST(request)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Audit failed')
  })

  it('uses admin client instead of user session', async () => {
    const mockAdmin = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(() =>
              Promise.resolve({
                data: { id: FAKE_UUIDS.business },
                error: null,
              })
            ),
          })),
        })),
      })),
    }

    mockedCreateAdminClient.mockReturnValue(mockAdmin as never)
    mockedRunMarginAudit.mockResolvedValue({
      margins: [],
      anomalies: [],
      insights_created: 0,
    } as never)

    const request = new Request('http://localhost/api/cron/margin-audit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mia-cron-secret': 'test-cron-secret-12345',
      },
      body: JSON.stringify({ business_id: FAKE_UUIDS.business }),
    })

    await POST(request)

    // Verify admin client was created and used for business lookup
    expect(mockedCreateAdminClient).toHaveBeenCalled()
    // Verify the from().select() chain was called
    expect(mockAdmin.from).toHaveBeenCalledWith('businesses')
  })
})

describe('GET /api/cron/margin-audit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns recent insights for a business', async () => {
    const mockInsights = [
      {
        id: 'i1',
        business_id: FAKE_UUIDS.business,
        insight_type: 'product_alert',
        content: 'Widget sales down 20%',
        dismissed_at: null,
        created_at: '2026-08-25T10:00:00Z',
      },
    ]

    const mockAdmin = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn((key: string) => ({
            eq: vi.fn((key2: string) => ({
              is: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() =>
                    Promise.resolve({
                      data: mockInsights,
                      error: null,
                    })
                  ),
                })),
              })),
            })),
          })),
        })),
      })),
    }

    mockedCreateAdminClient.mockReturnValue(mockAdmin as never)

    const request = new Request(
      `http://localhost/api/cron/margin-audit?business_id=${FAKE_UUIDS.business}`,
      { method: 'GET' }
    )

    const res = await GET(request)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.insights).toEqual(mockInsights)
  })

  it('returns 400 when business_id is missing from query', async () => {
    const request = new Request('http://localhost/api/cron/margin-audit', {
      method: 'GET',
    })

    const res = await GET(request)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('business_id required')
  })
})
