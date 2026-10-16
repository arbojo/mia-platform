import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FAKE_UUIDS } from '../fixtures'

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

vi.mock('@/lib/baileys/config', () => ({
  getBridgeSecret: vi.fn(() => 'bridge-secret'),
}))

vi.mock('@/lib/baileys/webhook-auth', () => ({
  verifyBridgeWebhookAuth: vi.fn(),
}))

vi.mock('@/lib/sales/recovery-scan', () => ({
  scanRecoveryCandidates: vi.fn(),
}))

import { POST } from '@/app/api/channels/baileys/recovery/route'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyBridgeWebhookAuth } from '@/lib/baileys/webhook-auth'
import { scanRecoveryCandidates } from '@/lib/sales/recovery-scan'

const mockedCreateAdminClient = vi.mocked(createAdminClient)
const mockedVerify = vi.mocked(verifyBridgeWebhookAuth)
const mockedScan = vi.mocked(scanRecoveryCandidates)

const BUSINESS_ID = FAKE_UUIDS.business
const CONNECTION_ID = 'conn-wa-1'

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/channels/baileys/recovery', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

function mockConnection(row: unknown) {
  const query: Record<string, unknown> = {}
  const self = () => query
  query.select = self
  query.eq = self
  query.maybeSingle = () => Promise.resolve({ data: row, error: null })
  mockedCreateAdminClient.mockReturnValue({ from: vi.fn(() => query) } as never)
}

describe('POST /api/channels/baileys/recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    mockedVerify.mockResolvedValue({ businessId: BUSINESS_ID, method: 'hmac' })
  })

  it('returns 401 when the bridge token header is missing', async () => {
    const res = await POST(request({ businessId: BUSINESS_ID, connectionId: CONNECTION_ID }))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Missing bridge token')
  })

  it('returns an empty list globally when the RECOVERY_ENABLED kill switch is off', async () => {
    vi.stubEnv('RECOVERY_ENABLED', '0')
    const res = await POST(
      request(
        { businessId: BUSINESS_ID, connectionId: CONNECTION_ID },
        { 'x-mia-webhook-secret': 'tk' }
      )
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, due: [] })
    expect(mockedVerify).not.toHaveBeenCalled()
    expect(mockedScan).not.toHaveBeenCalled()
  })

  it('returns 400 when connectionId is missing', async () => {
    const res = await POST(
      request({ businessId: BUSINESS_ID }, { 'x-mia-webhook-secret': 'tk' })
    )
    expect(res.status).toBe(400)
  })

  it('returns 401 when the bridge token is invalid', async () => {
    mockedVerify.mockResolvedValue(null)
    const res = await POST(
      request(
        { businessId: BUSINESS_ID, connectionId: CONNECTION_ID },
        { 'x-mia-webhook-secret': 'bad' }
      )
    )
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('Invalid bridge token')
  })

  it('returns an empty list when the connection is not active/connected', async () => {
    mockConnection(null)
    const res = await POST(
      request(
        { businessId: BUSINESS_ID, connectionId: CONNECTION_ID },
        { 'x-mia-webhook-secret': 'tk' }
      )
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, due: [] })
    expect(mockedScan).not.toHaveBeenCalled()
  })

  it('returns an empty list when recovery is not enabled on the connection', async () => {
    mockConnection({
      id: CONNECTION_ID,
      assistant_id: FAKE_UUIDS.assistant,
      configuration: { recovery_enabled: false },
    })
    const res = await POST(
      request(
        { businessId: BUSINESS_ID, connectionId: CONNECTION_ID },
        { 'x-mia-webhook-secret': 'tk' }
      )
    )
    expect(await res.json()).toEqual({ success: true, due: [] })
    expect(mockedScan).not.toHaveBeenCalled()
  })

  it('returns the due recoveries when recovery is enabled', async () => {
    mockConnection({
      id: CONNECTION_ID,
      assistant_id: FAKE_UUIDS.assistant,
      configuration: { recovery_enabled: true },
    })
    mockedScan.mockResolvedValue([
      {
        customerId: FAKE_UUIDS.customer,
        conversationId: FAKE_UUIDS.conversation,
        phone: '5214771234567',
        attempt: 1,
        content: 'hola',
        inboundVersion: '2026-02-01T11:45:00.000Z',
      },
    ])

    const res = await POST(
      request(
        { businessId: BUSINESS_ID, connectionId: CONNECTION_ID },
        { 'x-mia-webhook-secret': 'tk' }
      )
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.due).toHaveLength(1)
    expect(mockedScan).toHaveBeenCalledWith({
      connection: expect.objectContaining({ id: CONNECTION_ID }),
    })
  })
})
