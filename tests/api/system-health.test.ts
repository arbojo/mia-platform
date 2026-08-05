import { describe, it, expect, vi, beforeEach } from 'vitest'

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

vi.mock('@/lib/auth', () => ({
  requireAuth: vi.fn(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({})),
}))

vi.mock('@/lib/system/health', () => ({
  runHealthChecks: vi.fn(),
  getLatestHealthReport: vi.fn(),
}))

import { GET } from '@/app/api/system/health/route'
import { requireAuth } from '@/lib/auth'
import { runHealthChecks, getLatestHealthReport } from '@/lib/system/health'

const mockedRequireAuth = vi.mocked(requireAuth)
const mockedRunHealthChecks = vi.mocked(runHealthChecks)
const mockedGetLatestHealthReport = vi.mocked(getLatestHealthReport)

const mockReport = { id: 'h-1', status: 'passed', checks: [], summary: 'ok' }

beforeEach(() => {
  vi.clearAllMocks()
  mockedRequireAuth.mockResolvedValue({
    user: { id: 'user-1' },
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })) })),
        })),
      })),
    },
  } as never)
})

describe('GET /api/system/health', () => {
  it('devuelve el ultimo reporte sin refresh', async () => {
    mockedGetLatestHealthReport.mockResolvedValue(mockReport as never)
    const res = await GET(new Request('http://localhost/api/system/health'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ report: mockReport })
  })

  it('ejecuta health checks cuando refresh=1', async () => {
    mockedRunHealthChecks.mockResolvedValue(mockReport as never)
    const res = await GET(new Request('http://localhost/api/system/health?refresh=1'))
    expect(res.status).toBe(200)
    expect(mockedRunHealthChecks).toHaveBeenCalledTimes(1)
    expect(await res.json()).toEqual({ report: mockReport })
  })

  it('devuelve 500 ante error de auth', async () => {
    mockedRequireAuth.mockRejectedValue(new Error('Unauthorized'))
    const res = await GET(new Request('http://localhost/api/system/health'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toContain('Unauthorized')
  })
})
