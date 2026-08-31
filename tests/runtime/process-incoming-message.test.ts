import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/channels/identity', () => ({ resolveCustomer: vi.fn() }))
vi.mock('@/lib/conversation/context', () => ({ loadConversationContext: vi.fn() }))
vi.mock('@/lib/runtime/execute-ai', () => ({ executeAI: vi.fn() }))
vi.mock('@/lib/conversation/resolver', () => ({
  resolveConnection: vi.fn(),
  resolveConversation: vi.fn(),
}))
vi.mock('@/lib/runtime/intents', () => ({
  detectIntent: vi.fn(() => null),
  buildInteractiveForIntent: vi.fn(() => null),
}))
vi.mock('@/lib/sales/process', () => ({
  processSaleClosing: vi.fn(),
  isDiscountOfferSentinel: vi.fn(() => false),
}))
vi.mock('@/lib/sales/intent-classifier', () => ({
  classifyUserIntent: vi.fn(() => null),
}))
vi.mock('@/lib/runtime/conditional-media', () => ({
  resolveConditionalMedia: vi.fn(() => null),
}))
vi.mock('@/lib/runtime/media', () => ({
  isResendRequest: vi.fn(() => false),
}))
vi.mock('@/lib/runtime/media-guard', () => ({
  isSafeMediaUrl: vi.fn(() => true),
}))
vi.mock('@/lib/runtime/product-recommendation', () => ({
  resolveRecommendedProduct: vi.fn(() => null),
}))
vi.mock('@/lib/runtime/evidence-extraction', () => ({
  extractEvidenceFromCustomerMessage: vi.fn(),
}))
vi.mock('@/lib/runtime/runtime', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/runtime/runtime')>()
  return {
    ...original,
    resolveCancellationGuards: vi.fn(() =>
      Promise.resolve({ cancellationContext: null, lastCancelledOrder: null, userIntent: null })
    ),
  }
})

import { processIncomingMessage } from '@/lib/runtime/runtime'
import { resolveCustomer } from '@/lib/channels/identity'
import { loadConversationContext } from '@/lib/conversation/context'
import { executeAI } from '@/lib/runtime/execute-ai'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveConnection, resolveConversation } from '@/lib/conversation/resolver'
import { FAKE_UUIDS, mockWireMessage } from '../fixtures'

function makeSupabaseMock() {
  const mockInsert = vi.fn((_row: Record<string, unknown>) => chain)
  const mockSelect = vi.fn(() => chain)
  const mockEq = vi.fn(() => chain)
  const mockOrder = vi.fn(() => chain)
  const mockLimit = vi.fn(() => chain)
  const mockNot = vi.fn(() => chain)
  const mockUpdate = vi.fn(() => chain)
  const mockMaybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
  const mockSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
  const mockContains = vi.fn(() => chain)

  const chain = {
    insert: mockInsert,
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
    limit: mockLimit,
    not: mockNot,
    update: mockUpdate,
    single: mockSingle,
    maybeSingle: mockMaybeSingle,
    contains: mockContains,
  }

  const fromMock = vi.fn(() => chain)
  const supabase = { from: fromMock }

  return { supabase, fromMock, mockInsert, chain }
}

beforeEach(() => {
  vi.clearAllMocks()

  vi.mocked(resolveConnection).mockResolvedValue({
    business_id: FAKE_UUIDS.business,
    assistant_id: FAKE_UUIDS.assistant,
    mode: 'active',
  })

  vi.mocked(resolveConversation).mockResolvedValue(FAKE_UUIDS.conversation)

  vi.mocked(loadConversationContext).mockResolvedValue({
    systemPrompt: 'Eres un asistente.',
    usedContext: [],
    fullAssistant: { id: FAKE_UUIDS.assistant },
    businessId: FAKE_UUIDS.business,
    assistantId: FAKE_UUIDS.assistant,
  })

  vi.mocked(resolveCustomer).mockResolvedValue({
    id: FAKE_UUIDS.customer,
    businessId: FAKE_UUIDS.business,
    name: 'Test Customer',
    phone: null,
    email: null,
    isNew: false,
  })

  vi.mocked(executeAI).mockResolvedValue({
    content: 'Hola, ¿en qué puedo ayudarte?',
    usage: { promptTokens: 60, completionTokens: 10 },
  } as never)
})

describe('processIncomingMessage', () => {
  it('creates a new customer, persists messages, and returns response + ids', async () => {
    vi.mocked(resolveCustomer).mockResolvedValue({
      id: FAKE_UUIDS.customer,
      businessId: FAKE_UUIDS.business,
      name: 'New Customer',
      phone: null,
      email: null,
      isNew: true,
    })

    const { supabase } = makeSupabaseMock()
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    const result = await processIncomingMessage(
      'widget',
      mockWireMessage,
      {} as never
    )

    expect(result.customerId).toBe(FAKE_UUIDS.customer)
    expect(result.conversationId).toBe(FAKE_UUIDS.conversation)
    expect(result.response).toBe('Hola, ¿en qué puedo ayudarte?')
    expect(executeAI).toHaveBeenCalledOnce()
  })

  it('resolves existing customer and reuses active conversation', async () => {
    const { supabase } = makeSupabaseMock()
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    const result = await processIncomingMessage(
      'widget',
      mockWireMessage,
      {} as never
    )

    expect(result.customerId).toBe(FAKE_UUIDS.customer)
    expect(result.conversationId).toBe(FAKE_UUIDS.conversation)
  })

  it('persists incoming and outgoing channel_messages', async () => {
    const { supabase, mockInsert } = makeSupabaseMock()
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    await processIncomingMessage('widget', mockWireMessage, {} as never)

    const channelInsertCalls = mockInsert.mock.calls.filter(
      ([row]: [Record<string, unknown>]) => row.channel === 'widget'
    )
    expect(channelInsertCalls.length).toBe(2)
  })

  it('persists user and assistant messages exactly once via processCore (no double insert)', async () => {
    const { supabase, mockInsert } = makeSupabaseMock()
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    await processIncomingMessage('widget', mockWireMessage, {} as never)

    const messageInserts = mockInsert.mock.calls.filter(
      ([row]: [Record<string, unknown>]) =>
        row.role === 'user' || row.role === 'assistant'
    )
    expect(messageInserts.length).toBe(2)

    const userInserts = mockInsert.mock.calls.filter(
      ([row]: [Record<string, unknown>]) => row.role === 'user'
    )
    const assistantInserts = mockInsert.mock.calls.filter(
      ([row]: [Record<string, unknown>]) => row.role === 'assistant'
    )
    expect(userInserts.length).toBe(1)
    expect(assistantInserts.length).toBe(1)
  })

  it('updates customer last_interaction', async () => {
    const { supabase, chain } = makeSupabaseMock()
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    await processIncomingMessage('widget', mockWireMessage, {} as never)

    expect(chain.update).toHaveBeenCalled()
  })

  it('throws RuntimeError when connection cannot be resolved', async () => {
    const { supabase } = makeSupabaseMock()
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)
    vi.mocked(resolveConnection).mockRejectedValue(
      new Error('No active assistant found for business')
    )

    const badMessage = { ...mockWireMessage, metadata: {} }
    await expect(
      processIncomingMessage('widget', badMessage, {} as never)
    ).rejects.toThrow()
  })
})
