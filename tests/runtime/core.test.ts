import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@ai-sdk/openai', () => ({ openai: vi.fn(() => ({})) }))
vi.mock('ai', () => ({ streamText: vi.fn(), generateText: vi.fn() }))
vi.mock('@/lib/conversation/context', () => ({ loadConversationContext: vi.fn() }))
vi.mock('@/lib/ai/cost', () => ({ trackAiUsage: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/runtime/product-recommendation', () => ({ resolveRecommendedProduct: vi.fn() }))
vi.mock('@/lib/runtime/conditional-media', () => ({ resolveConditionalMedia: vi.fn() }))
vi.mock('@/lib/runtime/media', () => ({ isResendRequest: vi.fn(() => false) }))
vi.mock('@/lib/runtime/media-guard', () => ({ isSafeMediaUrl: vi.fn(() => true) }))
vi.mock('@/lib/runtime/evidence-extraction', () => ({ extractEvidenceFromCustomerMessage: vi.fn() }))
vi.mock('@/lib/channels/identity', () => ({ resolveCustomer: vi.fn() }))
vi.mock('@/lib/conversation/resolver', () => ({
  resolveConnection: vi.fn(),
  resolveConversation: vi.fn(),
}))
vi.mock('@/lib/sales/process', () => ({ processSaleClosing: vi.fn() }))

import { processCore } from '@/lib/runtime/core'
import { loadConversationContext } from '@/lib/conversation/context'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveRecommendedProduct } from '@/lib/runtime/product-recommendation'
import { resolveConditionalMedia } from '@/lib/runtime/conditional-media'
import { processSaleClosing } from '@/lib/sales/process'

function makeMockSupabase() {
  const insertMock = vi.fn((_payload: Record<string, unknown>) =>
    Promise.resolve({ data: null, error: null })
  )
  const mockMaybeSingle = vi.fn(() =>
    Promise.resolve({ data: null, error: null } as { data: unknown; error: unknown })
  )
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    not: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    insert: insertMock,
    update: vi.fn(() => chain),
    maybeSingle: mockMaybeSingle,
    then: (resolve: (v: { data: unknown; error: null }) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
  }
  const fromMock = vi.fn(() => chain)
  const supabase = { from: fromMock }

  return { supabase, fromMock, insertMock, mockMaybeSingle }
}

const FAKE_UUIDS = {
  business: 'b1111111-1111-1111-1111-111111111111',
  assistant: 'a1111111-1111-1111-1111-111111111111',
  customer: 'c1111111-1111-1111-1111-111111111111',
  conversation: 'd1111111-1111-1111-1111-111111111111',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(loadConversationContext).mockResolvedValue({
    systemPrompt: 'Test prompt',
    usedContext: [{ type: 'test', id: 't1' }],
    fullAssistant: { id: FAKE_UUIDS.assistant },
    businessId: FAKE_UUIDS.business,
    assistantId: FAKE_UUIDS.assistant,
  })
  vi.mocked(createAdminClient).mockReturnValue(makeMockSupabase().supabase as never)
  vi.mocked(resolveRecommendedProduct).mockResolvedValue(null)
  vi.mocked(resolveConditionalMedia).mockResolvedValue(null)
})

describe('processCore', () => {
  it('produces valid CoreOutput with response string in complete mode', async () => {
    const { generateText } = await import('ai')
    vi.mocked(generateText).mockResolvedValue({
      text: 'Hello from AI',
      usage: { promptTokens: 10, completionTokens: 5 },
    } as never)

    const result = await processCore({
      businessId: FAKE_UUIDS.business,
      assistantId: FAKE_UUIDS.assistant,
      userMessage: 'Hola',
      channel: 'simulation',
      mode: 'complete',
      requestType: 'training',
    })

    expect(result).toHaveProperty('response')
    expect(result).toHaveProperty('product')
    expect(result).toHaveProperty('media')
    expect(result).toHaveProperty('metadata')
    expect(typeof result.response).toBe('string')
    expect(result.metadata.deliver).toBe(true)
  })

  it('produces valid CoreOutput with textStream in stream mode', async () => {
    const { streamText } = await import('ai')
    vi.mocked(streamText).mockReturnValue({
      textStream: { [Symbol.asyncIterator]: async function* () { yield 'streaming' } },
      toTextStreamResponse: vi.fn(() => new Response()),
    } as never)

    const result = await processCore({
      businessId: FAKE_UUIDS.business,
      assistantId: FAKE_UUIDS.assistant,
      userMessage: 'Hola',
      channel: 'simulation',
      mode: 'stream',
      requestType: 'training',
    })

    expect(result).toHaveProperty('response')
    expect(result).toHaveProperty('textStream')
    expect(result.textStream).toBeDefined()
    expect(result.metadata.deliver).toBe(true)
  })

  it('handles zero-state gracefully (no conversationId)', async () => {
    const { generateText } = await import('ai')
    vi.mocked(generateText).mockResolvedValue({
      text: 'Response',
      usage: { promptTokens: 5, completionTokens: 3 },
    } as never)

    const result = await processCore({
      businessId: FAKE_UUIDS.business,
      assistantId: FAKE_UUIDS.assistant,
      userMessage: 'Test',
      channel: 'simulation',
      mode: 'complete',
      requestType: 'training',
    })

    expect(result.response).toBe('Response')
    expect(result.metadata.conversationId).toBeUndefined()
  })

  it('calls loadConversationContext with correct arguments', async () => {
    const { generateText } = await import('ai')
    vi.mocked(generateText).mockResolvedValue({
      text: 'Response',
      usage: { promptTokens: 5, completionTokens: 3 },
    } as never)

    await processCore({
      businessId: FAKE_UUIDS.business,
      assistantId: FAKE_UUIDS.assistant,
      userMessage: 'Test message',
      channel: 'web',
      mode: 'complete',
      requestType: 'training',
      intentTag: 'test_intent',
    })

    expect(loadConversationContext).toHaveBeenCalledWith(
      FAKE_UUIDS.business,
      FAKE_UUIDS.assistant,
      undefined,
      'web',
      'test_intent',
      undefined,
      null,
      null,
      null,
      null
    )
  })

  // D-DECISION-1: processSaleClosing is called in complete mode
  it('calls processSaleClosing in complete mode with conversationId', async () => {
    const { generateText } = await import('ai')
    vi.mocked(generateText).mockResolvedValue({
      text: 'Sale response',
      usage: { promptTokens: 10, completionTokens: 5 },
    } as never)

    await processCore({
      businessId: FAKE_UUIDS.business,
      assistantId: FAKE_UUIDS.assistant,
      customerId: FAKE_UUIDS.customer,
      conversationId: FAKE_UUIDS.conversation,
      userMessage: 'Quiero comprar esto',
      channel: 'simulation',
      mode: 'complete',
      requestType: 'live_customer',
    })

    expect(processSaleClosing).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: FAKE_UUIDS.business,
        assistantId: FAKE_UUIDS.assistant,
        conversationId: FAKE_UUIDS.conversation,
        customerId: FAKE_UUIDS.customer,
      })
    )
  })

  // D-DECISION-1: processSaleClosing is called in stream mode via onFinish
  it('calls processSaleClosing in stream mode via onFinish', async () => {
    const { streamText } = await import('ai')
    vi.mocked(streamText).mockImplementation(((config: { onFinish?: (params: { text: string; usage: { inputTokens: number; outputTokens: number } }) => Promise<void> }) => {
      // Capture the onFinish callback to call it later
      setTimeout(async () => {
        if (config.onFinish) {
          await config.onFinish({
            text: 'Sale response',
            usage: { inputTokens: 10, outputTokens: 5 },
          })
        }
      }, 0)
      return {
        textStream: { [Symbol.asyncIterator]: async function* () { yield 'streaming' } },
        toTextStreamResponse: vi.fn(() => new Response()),
      }
    }) as never)

    await processCore({
      businessId: FAKE_UUIDS.business,
      assistantId: FAKE_UUIDS.assistant,
      customerId: FAKE_UUIDS.customer,
      conversationId: FAKE_UUIDS.conversation,
      userMessage: 'Quiero comprar esto',
      channel: 'simulation',
      mode: 'stream',
      requestType: 'live_customer',
    })

    // Wait for setTimeout to execute
    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(processSaleClosing).toHaveBeenCalledWith(
      expect.objectContaining({
        businessId: FAKE_UUIDS.business,
        assistantId: FAKE_UUIDS.assistant,
        conversationId: FAKE_UUIDS.conversation,
        customerId: FAKE_UUIDS.customer,
      })
    )
  })

  // D-DECISION-1: processSaleClosing is NOT called without conversationId
  it('does not call processSaleClosing without conversationId', async () => {
    const { generateText } = await import('ai')
    vi.mocked(generateText).mockResolvedValue({
      text: 'Response',
      usage: { promptTokens: 5, completionTokens: 3 },
    } as never)

    await processCore({
      businessId: FAKE_UUIDS.business,
      assistantId: FAKE_UUIDS.assistant,
      userMessage: 'Test',
      channel: 'simulation',
      mode: 'complete',
      requestType: 'training',
    })

    expect(processSaleClosing).not.toHaveBeenCalled()
  })

  // Cross-channel parity: both modes produce equivalent CoreOutput structure
  it('stream and complete modes produce equivalent CoreOutput structure', async () => {
    const { generateText, streamText } = await import('ai')
    vi.mocked(generateText).mockResolvedValue({
      text: 'Response',
      usage: { promptTokens: 5, completionTokens: 3 },
    } as never)
    vi.mocked(streamText).mockReturnValue({
      textStream: { [Symbol.asyncIterator]: async function* () { yield 'streaming' } },
      toTextStreamResponse: vi.fn(() => new Response()),
    } as never)

    const completeResult = await processCore({
      businessId: FAKE_UUIDS.business,
      assistantId: FAKE_UUIDS.assistant,
      userMessage: 'Test',
      channel: 'simulation',
      mode: 'complete',
      requestType: 'training',
    })

    const streamResult = await processCore({
      businessId: FAKE_UUIDS.business,
      assistantId: FAKE_UUIDS.assistant,
      userMessage: 'Test',
      channel: 'simulation',
      mode: 'stream',
      requestType: 'training',
    })

    // Both should have the same structure
    expect(typeof completeResult.response).toBe('string')
    expect(typeof streamResult.response).toBe('string')
    expect(completeResult).toHaveProperty('product')
    expect(streamResult).toHaveProperty('product')
    expect(completeResult).toHaveProperty('media')
    expect(streamResult).toHaveProperty('media')
    expect(completeResult).toHaveProperty('metadata')
    expect(streamResult).toHaveProperty('metadata')
    expect(completeResult.metadata.deliver).toBe(true)
    expect(streamResult.metadata.deliver).toBe(true)
  })
})
