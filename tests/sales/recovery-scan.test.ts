import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FAKE_UUIDS } from '../fixtures'

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

import { scanRecoveryCandidates } from '@/lib/sales/recovery-scan'
import { createAdminClient } from '@/lib/supabase/admin'

const mockedCreateAdminClient = vi.mocked(createAdminClient)

const NOW = new Date('2026-02-01T12:00:00.000Z').getTime()
const MIN = 60_000
const HOUR = 60 * MIN

const CONNECTION = {
  id: 'conn-wa-1',
  assistant_id: FAKE_UUIDS.assistant,
  configuration: { recovery_enabled: true },
}

interface Datasets {
  conversations?: unknown[]
  messages?: unknown[]
  customers?: unknown[]
  channel_messages?: unknown[]
  sales_events?: unknown[]
}

function makeQuery(result: { data: unknown; error: null }) {
  const query: Record<string, unknown> = {}
  const self = () => query
  query.select = self
  query.eq = self
  query.gte = self
  query.in = self
  query.order = self
  query.limit = self
  query.maybeSingle = () => Promise.resolve(result)
  query.single = () => Promise.resolve(result)
  query.then = (resolve: (value: unknown) => unknown) => resolve(result)
  return query
}

function installDatasets(datasets: Datasets): void {
  const byTable: Record<string, { data: unknown; error: null }> = {
    conversations: { data: datasets.conversations ?? [], error: null },
    messages: { data: datasets.messages ?? [], error: null },
    customers: { data: datasets.customers ?? [], error: null },
    channel_messages: { data: datasets.channel_messages ?? [], error: null },
    sales_events: { data: datasets.sales_events ?? [], error: null },
  }
  mockedCreateAdminClient.mockReturnValue({
    from: vi.fn((table: string) => makeQuery(byTable[table] ?? { data: [], error: null })),
  } as never)
}

const conversation = {
  id: FAKE_UUIDS.conversation,
  customer_id: FAKE_UUIDS.customer,
  status: 'active',
  outcome: null,
  ai_paused_at: null,
  sales_cancelled_at: null,
}

const customer = { id: FAKE_UUIDS.customer, phone: '5214771234567', status: null }

const inbound = (msAgo: number) => ({
  conversation_id: FAKE_UUIDS.conversation,
  created_at: new Date(NOW - msAgo).toISOString(),
})

const miaOut = (msAgo: number, metadata: Record<string, unknown> | null = null) => ({
  customer_id: FAKE_UUIDS.customer,
  created_at: new Date(NOW - msAgo).toISOString(),
  metadata,
})

const salesEvent = (eventType: string, msAgo: number) => ({
  conversation_id: FAKE_UUIDS.conversation,
  event_type: eventType,
  created_at: new Date(NOW - msAgo).toISOString(),
})

describe('scanRecoveryCandidates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns attempt 1 when MIA answered a commercial enquiry 15 minutes ago', async () => {
    installDatasets({
      conversations: [conversation],
      customers: [customer],
      messages: [inbound(15 * MIN)],
      channel_messages: [miaOut(12 * MIN)],
      sales_events: [salesEvent('SALE_STARTED', 40 * MIN)],
    })

    const due = await scanRecoveryCandidates({ connection: CONNECTION, now: NOW })

    expect(due).toHaveLength(1)
    expect(due[0]).toMatchObject({
      customerId: FAKE_UUIDS.customer,
      conversationId: FAKE_UUIDS.conversation,
      attempt: 1,
      phone: '5214771234567',
    })
    expect(due[0].inboundVersion).toBe(new Date(NOW - 15 * MIN).toISOString())
  })

  it('returns attempt 2 at 2 hours when attempt 1 was already sent for the version', async () => {
    const version = new Date(NOW - 3 * HOUR).toISOString()
    installDatasets({
      conversations: [conversation],
      customers: [customer],
      messages: [inbound(3 * HOUR)],
      channel_messages: [
        miaOut(3 * HOUR - 1 * MIN),
        miaOut(2 * HOUR, {
          recovery: true,
          recovery_attempt: 1,
          recovery_inbound_version: version,
          connection_id: CONNECTION.id,
        }),
      ],
      sales_events: [salesEvent('PRODUCT_SELECTED', 4 * HOUR)],
    })

    const due = await scanRecoveryCandidates({ connection: CONNECTION, now: NOW })

    expect(due).toHaveLength(1)
    expect(due[0].attempt).toBe(2)
  })

  it('does not duplicate an attempt already marked for the same inbound version', async () => {
    const version = new Date(NOW - 15 * MIN).toISOString()
    installDatasets({
      conversations: [conversation],
      customers: [customer],
      messages: [inbound(15 * MIN)],
      channel_messages: [
        miaOut(12 * MIN),
        miaOut(9 * MIN, {
          recovery: true,
          recovery_attempt: 1,
          recovery_inbound_version: version,
          connection_id: CONNECTION.id,
        }),
      ],
      sales_events: [salesEvent('SALE_STARTED', 40 * MIN)],
    })

    const due = await scanRecoveryCandidates({ connection: CONNECTION, now: NOW })
    expect(due).toHaveLength(0)
  })

  it('resets (no duplicate) when the customer replies and a new version starts', async () => {
    const oldVersion = new Date(NOW - 3 * HOUR).toISOString()
    installDatasets({
      conversations: [conversation],
      customers: [customer],
      // Newest inbound is 15 min ago → a fresh version.
      messages: [inbound(3 * HOUR), inbound(15 * MIN)],
      channel_messages: [
        miaOut(12 * MIN),
        miaOut(2 * HOUR, {
          recovery: true,
          recovery_attempt: 1,
          recovery_inbound_version: oldVersion,
          connection_id: CONNECTION.id,
        }),
      ],
      sales_events: [salesEvent('SALE_STARTED', 4 * HOUR)],
    })

    const due = await scanRecoveryCandidates({ connection: CONNECTION, now: NOW })
    expect(due).toHaveLength(1)
    expect(due[0].attempt).toBe(1)
    expect(due[0].inboundVersion).toBe(new Date(NOW - 15 * MIN).toISOString())
  })

  it('excludes non-commercial conversations', async () => {
    installDatasets({
      conversations: [conversation],
      customers: [customer],
      messages: [inbound(15 * MIN)],
      channel_messages: [miaOut(12 * MIN)],
      sales_events: [],
    })

    expect(await scanRecoveryCandidates({ connection: CONNECTION, now: NOW })).toHaveLength(0)
  })

  it('excludes conversations with a confirmed order', async () => {
    installDatasets({
      conversations: [conversation],
      customers: [customer],
      messages: [inbound(15 * MIN)],
      channel_messages: [miaOut(12 * MIN)],
      sales_events: [salesEvent('SALE_STARTED', 40 * MIN), salesEvent('SALE_WON', 20 * MIN)],
    })

    expect(await scanRecoveryCandidates({ connection: CONNECTION, now: NOW })).toHaveLength(0)
  })

  it('allows recovery again when a new commercial cycle opens after an order', async () => {
    installDatasets({
      conversations: [conversation],
      customers: [customer],
      messages: [inbound(15 * MIN)],
      channel_messages: [miaOut(12 * MIN)],
      sales_events: [
        salesEvent('SALE_WON', 120 * MIN),
        salesEvent('SALE_STARTED', 40 * MIN),
      ],
    })

    const due = await scanRecoveryCandidates({ connection: CONNECTION, now: NOW })
    expect(due).toHaveLength(1)
    expect(due[0].attempt).toBe(1)
  })

  it('excludes conversations under human takeover', async () => {
    installDatasets({
      conversations: [{ ...conversation, ai_paused_at: new Date(NOW - MIN).toISOString() }],
      customers: [customer],
      messages: [inbound(15 * MIN)],
      channel_messages: [miaOut(12 * MIN)],
      sales_events: [salesEvent('SALE_STARTED', 40 * MIN)],
    })

    expect(await scanRecoveryCandidates({ connection: CONNECTION, now: NOW })).toHaveLength(0)
  })

  it('excludes a customer that rejected the offer (status lost)', async () => {
    installDatasets({
      conversations: [conversation],
      customers: [{ ...customer, status: 'lost' }],
      messages: [inbound(15 * MIN)],
      channel_messages: [miaOut(12 * MIN)],
      sales_events: [salesEvent('SALE_STARTED', 40 * MIN)],
    })

    expect(await scanRecoveryCandidates({ connection: CONNECTION, now: NOW })).toHaveLength(0)
  })

  it('excludes when the customer wrote after MIA and is awaiting a reply', async () => {
    installDatasets({
      conversations: [conversation],
      customers: [customer],
      messages: [inbound(15 * MIN)],
      channel_messages: [miaOut(20 * MIN)],
      sales_events: [salesEvent('SALE_STARTED', 40 * MIN)],
    })

    expect(await scanRecoveryCandidates({ connection: CONNECTION, now: NOW })).toHaveLength(0)
  })

  it('excludes when the customer has no phone', async () => {
    installDatasets({
      conversations: [conversation],
      customers: [{ ...customer, phone: null }],
      messages: [inbound(15 * MIN)],
      channel_messages: [miaOut(12 * MIN)],
      sales_events: [salesEvent('SALE_STARTED', 40 * MIN)],
    })

    expect(await scanRecoveryCandidates({ connection: CONNECTION, now: NOW })).toHaveLength(0)
  })

  it('excludes when there is no inbound message within the 24h window', async () => {
    installDatasets({
      conversations: [conversation],
      customers: [customer],
      // No messages returned: the query filters by created_at >= windowStart.
      messages: [],
      channel_messages: [miaOut(12 * MIN)],
      sales_events: [salesEvent('SALE_STARTED', 40 * MIN)],
    })

    expect(await scanRecoveryCandidates({ connection: CONNECTION, now: NOW })).toHaveLength(0)
  })
})
