import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/channels/identity', () => ({ resolveCustomer: vi.fn() }))
vi.mock('@/lib/conversation/context', () => ({ loadConversationContext: vi.fn() }))
vi.mock('@/lib/ai/client', () => ({ getOpenAIClient: vi.fn(), MODEL: 'gpt-4o-mini' }))
vi.mock('@/lib/ai/cost', () => ({ trackAiUsage: vi.fn() }))

import { processIncomingMessage } from '@/lib/runtime/runtime'
import { resolveCustomer } from '@/lib/channels/identity'
import { loadConversationContext } from '@/lib/conversation/context'
import { getOpenAIClient } from '@/lib/ai/client'
import { trackAiUsage } from '@/lib/ai/cost'
import { createAdminClient } from '@/lib/supabase/admin'
import { FAKE_UUIDS, mockWireMessage } from '../fixtures'

function makeSupabaseMock(opts: {
  assistantData?: Record<string, unknown> | null
  existingConversationData?: Record<string, unknown> | null
  newConversationData?: Record<string, unknown> | null
  messagesData?: Array<Record<string, unknown>> | null
}) {
  const singleResponses: Array<Promise<{ data: unknown; error: null }>> = [
    Promise.resolve({ data: opts.assistantData ?? null, error: null }),
  ]
  if (opts.existingConversationData !== undefined) {
    singleResponses.push(
      Promise.resolve({ data: opts.existingConversationData, error: null })
    )
  }
  if (opts.newConversationData !== undefined) {
    singleResponses.push(
      Promise.resolve({ data: opts.newConversationData, error: null })
    )
  }

  let singleIndex = 0
  const mockSingle = vi.fn(() => {
    const resp = singleResponses[singleIndex] ?? Promise.resolve({ data: null, error: null })
    singleIndex++
    return resp
  })

  const mockInsert = vi.fn(() => chain)
  const mockSelect = vi.fn(() => chain)
  const mockEq = vi.fn(() => chain)
  const mockOrder = vi.fn(() => chain)
  const mockLimit = vi.fn(() => chain)
  const mockContains = vi.fn(() => chain)
  const mockNot = vi.fn(() => chain)
  const mockUpdate = vi.fn(() => chain)

  const chain = {
    insert: mockInsert,
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
    limit: mockLimit,
    contains: mockContains,
    not: mockNot,
    update: mockUpdate,
    single: mockSingle,
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
  } as never

  const fromMock = vi.fn(() => chain)
  const supabase = { from: fromMock }

  return { supabase, fromMock, mockInsert, mockSingle, chain }
}

beforeEach(() => {
  vi.clearAllMocks()

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

  vi.mocked(getOpenAIClient).mockReturnValue({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          id: 'cmpl-test',
          choices: [{ message: { content: 'Hola, ¿en qué puedo ayudarte?' }, finish_reason: 'stop', index: 0 }],
          usage: { prompt_tokens: 60, completion_tokens: 10, total_tokens: 70 },
        }),
      },
    },
  } as never)

  vi.mocked(trackAiUsage).mockResolvedValue(undefined)
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

    const { supabase } = makeSupabaseMock({
      assistantData: { id: FAKE_UUIDS.assistant, business_id: FAKE_UUIDS.business },
      existingConversationData: null,
      newConversationData: { id: FAKE_UUIDS.conversation },
    })
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    const result = await processIncomingMessage(
      'widget',
      mockWireMessage,
      {} as never
    )

    expect(result.customerId).toBe(FAKE_UUIDS.customer)
    expect(result.conversationId).toBe(FAKE_UUIDS.conversation)
    expect(result.response).toBe('Hola, ¿en qué puedo ayudarte?')
    expect(trackAiUsage).toHaveBeenCalled()
  })

  it('resolves existing customer and reuses active conversation', async () => {
    const { supabase } = makeSupabaseMock({
      assistantData: { id: FAKE_UUIDS.assistant, business_id: FAKE_UUIDS.business },
      existingConversationData: { id: FAKE_UUIDS.conversation },
    })
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
    const { supabase, mockInsert } = makeSupabaseMock({
      assistantData: { id: FAKE_UUIDS.assistant, business_id: FAKE_UUIDS.business },
      existingConversationData: { id: FAKE_UUIDS.conversation },
    })
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    await processIncomingMessage('widget', mockWireMessage, {} as never)

    const channelInsertCalls = mockInsert.mock.calls.filter(
      ([row]: [Record<string, unknown>]) => row.channel === 'widget'
    )
    expect(channelInsertCalls.length).toBeGreaterThanOrEqual(2)
  })

  it('persists user and assistant messages when conversation exists', async () => {
    const { supabase, mockInsert } = makeSupabaseMock({
      assistantData: { id: FAKE_UUIDS.assistant, business_id: FAKE_UUIDS.business },
      existingConversationData: { id: FAKE_UUIDS.conversation },
    })
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    await processIncomingMessage('widget', mockWireMessage, {} as never)

    const messageInserts = mockInsert.mock.calls.filter(
      ([row]: [Record<string, unknown>]) =>
        row.role === 'user' || row.role === 'assistant'
    )
    expect(messageInserts.length).toBe(2)
  })

  it('updates customer last_interaction', async () => {
    const { supabase, chain } = makeSupabaseMock({
      assistantData: { id: FAKE_UUIDS.assistant, business_id: FAKE_UUIDS.business },
      existingConversationData: { id: FAKE_UUIDS.conversation },
    })
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    await processIncomingMessage('widget', mockWireMessage, {} as never)

    expect(chain.update).toHaveBeenCalled()
  })

  it('throws RuntimeError when connection cannot be resolved', async () => {
    const { supabase } = makeSupabaseMock({
      assistantData: { id: FAKE_UUIDS.assistant, business_id: FAKE_UUIDS.business },
    })
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    const badMessage = { ...mockWireMessage, metadata: {} }
    await expect(
      processIncomingMessage('widget', badMessage, {} as never)
    ).rejects.toThrow()
  })
})
