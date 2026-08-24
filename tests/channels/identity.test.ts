import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { resolveCustomer } from '@/lib/channels/identity'
import { createAdminClient } from '@/lib/supabase/admin'
import { FAKE_UUIDS, mockCustomer } from '../fixtures'

function makeMockSupabase() {
  const mockSingle = vi.fn()
  const mockMaybeSingle = vi.fn()
  const chain = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    insert: vi.fn((_row: Record<string, unknown>) => chain),
    limit: vi.fn(() => chain),
    not: vi.fn(() => chain),
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
  }

  const fromMock = vi.fn(() => chain)
  const supabase = { from: fromMock }

  return { supabase, fromMock, mockSingle, mockMaybeSingle, chain }
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
    const { supabase, mockSingle, mockMaybeSingle } = makeMockSupabase()
    mockMaybeSingle.mockResolvedValueOnce({ data: { customer_id: FAKE_UUIDS.customer }, error: null })
    mockSingle.mockResolvedValueOnce({ data: mockCustomer, error: null })
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    const result = await resolveCustomer(businessId, baseMessage)

    expect(result.id).toBe(FAKE_UUIDS.customer)
    expect(result.isNew).toBe(false)
  })

  it('finds existing customer by phone', async () => {
    const { supabase, mockMaybeSingle, chain } = makeMockSupabase()
    const updateCalls: Array<Record<string, unknown>> = []
    chain.update = vi.fn((patch: Record<string, unknown>) => {
      updateCalls.push(patch)
      return { eq: vi.fn().mockResolvedValue({ error: null }) }
    })
    mockMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { ...mockCustomer, id: FAKE_UUIDS.customer }, error: null })
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    const result = await resolveCustomer(businessId, {
      ...baseMessage,
      customerPhone: '+521234567890',
    })

    expect(result.id).toBe(FAKE_UUIDS.customer)
    expect(result.isNew).toBe(false)
    expect(updateCalls).toEqual([{ phone: '+521234567890' }])
  })

  it('finds existing customer by email', async () => {
    const { supabase, mockMaybeSingle } = makeMockSupabase()
    mockMaybeSingle
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
    const { supabase, mockSingle, mockMaybeSingle, chain } = makeMockSupabase()
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    mockSingle.mockResolvedValueOnce({
      data: { ...mockCustomer, id: FAKE_UUIDS.customer, name: 'Juan Pérez' },
      error: null,
    })

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
    const { supabase, mockSingle, mockMaybeSingle } = makeMockSupabase()
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null })
    mockSingle.mockResolvedValueOnce({
      data: { ...mockCustomer, id: FAKE_UUIDS.customer },
      error: null,
    })

    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    const result = await resolveCustomer(businessId, {
      ...baseMessage,
      customerName: 'No Name',
    })

    expect(result.isNew).toBe(true)
  })
})

describe('resolveCustomer — enriquecimiento de customer existente', () => {
  const businessId = FAKE_UUIDS.business
  const baseMessage = {
    channel: 'widget',
    customerExternalId: 'ext-001',
  }

  function makeEnrichableMock() {
    const { supabase, mockSingle, mockMaybeSingle, chain } = makeMockSupabase()
    const updateCalls: Array<Record<string, unknown>> = []

    chain.update = vi.fn((patch: Record<string, unknown>) => {
      updateCalls.push(patch)
      return {
        eq: vi.fn().mockResolvedValue({ error: null }),
      }
    })

    return { supabase, mockSingle, mockMaybeSingle, updateCalls }
  }

  it('rellena el telefono vacio con el del mensaje (caso B)', async () => {
    const { supabase, mockSingle, mockMaybeSingle, updateCalls } = makeEnrichableMock()
    mockMaybeSingle.mockResolvedValueOnce({
      data: { customer_id: FAKE_UUIDS.customer },
      error: null,
    })
    mockSingle.mockResolvedValueOnce({ data: mockCustomer, error: null })
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    const result = await resolveCustomer(businessId, {
      ...baseMessage,
      customerName: 'Test Customer',
      customerPhone: '+521234567890',
    })

    expect(updateCalls).toHaveLength(1)
    expect(updateCalls[0]).toEqual({ phone: '+521234567890' })
    expect(result.phone).toBe('+521234567890')
    expect(result.isNew).toBe(false)
  })

  it('no sobrescribe datos existentes (caso C)', async () => {
    const { supabase, mockSingle, mockMaybeSingle, updateCalls } = makeEnrichableMock()
    mockMaybeSingle.mockResolvedValueOnce({
      data: { customer_id: FAKE_UUIDS.customer },
      error: null,
    })
    mockSingle.mockResolvedValueOnce({
      data: { ...mockCustomer, phone: '+521111111111' },
      error: null,
    })
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    const result = await resolveCustomer(businessId, {
      ...baseMessage,
      customerName: 'Otro Nombre',
      customerPhone: '+522222222222',
    })

    expect(updateCalls).toHaveLength(0)
    expect(result.name).toBe('Test Customer')
    expect(result.phone).toBe('+521111111111')
  })

  it('no escribe nada cuando el mensaje no aporta identidad (caso D)', async () => {
    const { supabase, mockSingle, mockMaybeSingle, updateCalls } = makeEnrichableMock()
    mockMaybeSingle.mockResolvedValueOnce({
      data: { customer_id: FAKE_UUIDS.customer },
      error: null,
    })
    mockSingle.mockResolvedValueOnce({ data: mockCustomer, error: null })
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    await resolveCustomer(businessId, baseMessage)

    expect(updateCalls).toHaveLength(0)
  })

  it('propaga el error cuando la escritura de enriquecimiento falla (caso H)', async () => {
    const { supabase, mockSingle, mockMaybeSingle, chain } = makeMockSupabase()
    mockMaybeSingle.mockResolvedValueOnce({
      data: { customer_id: FAKE_UUIDS.customer },
      error: null,
    })
    mockSingle.mockResolvedValueOnce({ data: mockCustomer, error: null })
    chain.update = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: { message: 'db write failed' } }),
    }))
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    await expect(
      resolveCustomer(businessId, {
        ...baseMessage,
        customerPhone: '+521234567890',
      })
    ).rejects.toThrow('Failed to enrich customer')
  })
})
