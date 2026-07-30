import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { resolveCustomer } from '@/lib/channels/identity'
import { createAdminClient } from '@/lib/supabase/admin'
import { FAKE_UUIDS, mockCustomer } from '../fixtures'

function makeMockSupabase() {
  const mockSingle = vi.fn()
  const chain = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    not: vi.fn(() => chain),
    single: mockSingle,
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }

  const fromMock = vi.fn(() => chain)
  const supabase = { from: fromMock }

  return { supabase, fromMock, mockSingle, chain }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('resolveCustomer', () => {
  const businessId = FAKE_UUIDS.business
  const baseMessage = {
    channel: 'widget',
    customerExternalId: 'ext-001',
    customerName: 'Juan Pérez',
  }

  it('finds existing customer by external_customer_id', async () => {
    const { supabase, mockSingle } = makeMockSupabase()
    mockSingle
      .mockResolvedValueOnce({ data: { customer_id: FAKE_UUIDS.customer }, error: null })
      .mockResolvedValueOnce({ data: mockCustomer, error: null })
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    const result = await resolveCustomer(businessId, baseMessage)

    expect(result.id).toBe(FAKE_UUIDS.customer)
    expect(result.isNew).toBe(false)
  })

  it('finds existing customer by phone', async () => {
    const { supabase, mockSingle } = makeMockSupabase()
    mockSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { ...mockCustomer, id: FAKE_UUIDS.customer }, error: null })
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    const result = await resolveCustomer(businessId, {
      ...baseMessage,
      customerPhone: '+521234567890',
    })

    expect(result.id).toBe(FAKE_UUIDS.customer)
    expect(result.isNew).toBe(false)
  })

  it('finds existing customer by email', async () => {
    const { supabase, mockSingle } = makeMockSupabase()
    mockSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { ...mockCustomer, id: FAKE_UUIDS.customer }, error: null })
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    const result = await resolveCustomer(businessId, {
      ...baseMessage,
      customerEmail: 'juan@example.com',
    })

    expect(result.id).toBe(FAKE_UUIDS.customer)
    expect(result.isNew).toBe(false)
  })

  it('creates a new customer when no match found', async () => {
    const { supabase, mockSingle, chain } = makeMockSupabase()
    mockSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { ...mockCustomer, id: FAKE_UUIDS.customer, name: 'Juan Pérez' }, error: null })

    const insertCalls: Array<Record<string, unknown>> = []
    chain.insert = vi.fn((row: Record<string, unknown>) => {
      insertCalls.push(row)
      return chain
    })

    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    const result = await resolveCustomer(businessId, {
      ...baseMessage,
      customerName: 'Juan Pérez',
    })

    expect(result.id).toBe(FAKE_UUIDS.customer)
    expect(result.isNew).toBe(true)
    expect(insertCalls).toHaveLength(1)
    expect(insertCalls[0]).toMatchObject({
      business_id: businessId,
      name: 'Juan Pérez',
    })
  })

  it('returns isNew:true for newly created customer', async () => {
    const { supabase, mockSingle, chain } = makeMockSupabase()
    mockSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { ...mockCustomer, id: FAKE_UUIDS.customer }, error: null })

    chain.insert = vi.fn(() => chain)
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    const result = await resolveCustomer(businessId, {
      ...baseMessage,
      customerName: 'No Name',
    })

    expect(result.isNew).toBe(true)
  })
})
