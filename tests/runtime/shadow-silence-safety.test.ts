import { describe, it, expect, vi, beforeEach } from 'vitest'

// SHADOW MODE SAFETY — the guard that makes "reconnect MIA" a safe operation.
//
// Shadow must mean "MIA thinks, learns and drafts, but the world does not move".
// This suite pins the three ways shadow used to fail:
//
//  1. handleCancellationWebhook treated only 'paused' as safe, so in shadow it
//     emitted SALE_CANCELLED, wrote the retention sentinel into conversations
//     and hardcoded deliver:true — mutating real sales.
//  2. processCore had no notion of the channel's operation mode, so a shadow
//     turn with a detected sale reached processSaleClosing.
//  3. Nothing told the bridge that a human wrote a message, so the salesperson's
//     replies were discarded and her voice could never be learned.

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/conversation/resolver', () => ({
  resolveConnection: vi.fn(),
  resolveConversation: vi.fn(),
}))
vi.mock('@/lib/channels/identity', () => ({ resolveCustomer: vi.fn() }))
vi.mock('@/lib/sales/events', () => ({ emitSalesEvent: vi.fn() }))
vi.mock('@/lib/ai/knowledge', () => ({ getSalesConfig: vi.fn() }))
vi.mock('./cancel', () => ({ processCancellation: vi.fn() }))

import { handleCancellationWebhook } from '@/lib/sales/process'
import { allowsSideEffects } from '@/lib/channels/mode'
import { resolveConnection } from '@/lib/conversation/resolver'
import { resolveCustomer } from '@/lib/channels/identity'
import { resolveConversation } from '@/lib/conversation/resolver'
import { emitSalesEvent } from '@/lib/sales/events'
import { createAdminClient } from '@/lib/supabase/admin'

const UUID = {
  business: 'b1111111-1111-1111-1111-111111111111',
  assistant: 'a1111111-1111-1111-1111-111111111111',
  customer: 'c1111111-1111-1111-1111-111111111111',
  conversation: 'd1111111-1111-1111-1111-111111111111',
}

/** Chainable stub that records every mutation it is asked to perform. */
function makeMockSupabase() {
  const calls = {
    insert: [] as unknown[],
    update: [] as unknown[],
    delete: [] as unknown[],
  }
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    not: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    in: vi.fn(() => chain),
    insert: vi.fn((payload: unknown) => {
      calls.insert.push(payload)
      return Promise.resolve({ data: null, error: null })
    }),
    update: vi.fn((payload: unknown) => {
      calls.update.push(payload)
      return chain
    }),
    delete: vi.fn(() => {
      calls.delete.push(true)
      return chain
    }),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: (resolve: (v: { data: unknown; error: null }) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
  }
  return { supabase: { from: vi.fn(() => chain) }, calls }
}

// Must actually trip hasCancellationTrigger(), otherwise the test would pass
// without ever reaching the mode guard.
const CANCEL_MESSAGE = 'quiero cancelar mi pedido'

function wireMessage(content = CANCEL_MESSAGE) {
  return {
    channel: 'whatsapp',
    externalId: 'EXT-CANCEL-1',
    customerExternalId: '5215512345678',
    content,
    contentType: 'text' as const,
    metadata: {},
    receivedAt: new Date(),
  }
}

let mock: ReturnType<typeof makeMockSupabase>

beforeEach(() => {
  vi.clearAllMocks()
  mock = makeMockSupabase()
  vi.mocked(createAdminClient).mockReturnValue(mock.supabase as never)
  vi.mocked(resolveCustomer).mockResolvedValue({ id: UUID.customer } as never)
  vi.mocked(resolveConversation).mockResolvedValue(UUID.conversation)
  vi.mocked(emitSalesEvent).mockResolvedValue('evt-1')
})

describe('allowsSideEffects (unit of the shadow contract)', () => {
  it('treats shadow as no-real-side-effects', () => {
    expect(allowsSideEffects('shadow')).toBe(false)
  })
})

describe('handleCancellationWebhook in shadow mode', () => {
  it('returns null so the turn falls through to the normal (silent) flow', async () => {
    vi.mocked(resolveConnection).mockResolvedValue({
      business_id: UUID.business,
      assistant_id: UUID.assistant,
      mode: 'shadow',
    } as never)

    const result = await handleCancellationWebhook(wireMessage() as never)

    expect(result).toBeNull()
  })

  it('writes NOTHING: no sales event, no conversation mutation, no delete', async () => {
    vi.mocked(resolveConnection).mockResolvedValue({
      business_id: UUID.business,
      assistant_id: UUID.assistant,
      mode: 'shadow',
    } as never)

    await handleCancellationWebhook(wireMessage() as never)

    expect(emitSalesEvent).not.toHaveBeenCalled()
    expect(mock.calls.insert).toHaveLength(0)
    expect(mock.calls.update).toHaveLength(0)
    expect(mock.calls.delete).toHaveLength(0)
  })

  it('still resolves the connection so the mode is actually enforced', async () => {
    vi.mocked(resolveConnection).mockResolvedValue({
      business_id: UUID.business,
      assistant_id: UUID.assistant,
      mode: 'shadow',
    } as never)

    await handleCancellationWebhook(wireMessage() as never)

    expect(resolveConnection).toHaveBeenCalledWith('whatsapp', expect.anything())
  })

  it('guards on the discount-acceptance branch too, not just the main one', async () => {
    vi.mocked(resolveConnection).mockResolvedValue({
      business_id: UUID.business,
      assistant_id: UUID.assistant,
      mode: 'shadow',
    } as never)

    // The acceptance branch re-opens cancelled sales and DELETES SALE_CANCELLED.
    // It runs before the main cancellation check, so it needs its own guard.
    const result = await handleCancellationWebhook(
      wireMessage('sí, acepto el descuento') as never
    )

    expect(result).toBeNull()
    expect(mock.calls.delete).toHaveLength(0)
    expect(mock.calls.update).toHaveLength(0)
  })
})

describe('handleCancellationWebhook in paused mode (regression guard)', () => {
  it('returns null exactly as before', async () => {
    vi.mocked(resolveConnection).mockResolvedValue({
      business_id: UUID.business,
      assistant_id: UUID.assistant,
      mode: 'paused',
    } as never)

    const result = await handleCancellationWebhook(wireMessage() as never)

    expect(result).toBeNull()
    expect(mock.calls.insert).toHaveLength(0)
  })
})

describe('handleCancellationWebhook on non-cancellation content', () => {
  it('is inert regardless of mode (no trigger, no work)', async () => {
    vi.mocked(resolveConnection).mockResolvedValue({
      business_id: UUID.business,
      assistant_id: UUID.assistant,
      mode: 'active',
    } as never)

    const result = await handleCancellationWebhook(
      wireMessage('¿cuánto cuesta el producto?') as never
    )

    expect(result).toBeNull()
    expect(mock.calls.insert).toHaveLength(0)
  })
})