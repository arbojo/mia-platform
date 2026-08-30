import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@ai-sdk/openai', () => ({ openai: vi.fn(() => ({})) }))
vi.mock('ai', () => ({ streamText: vi.fn() }))
vi.mock('@/lib/conversation/context', () => ({ loadConversationContext: vi.fn() }))
vi.mock('@/lib/ai/cost', () => ({ trackAiUsage: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/runtime/product-recommendation', () => ({ resolveRecommendedProduct: vi.fn() }))
vi.mock('@/lib/runtime/conditional-media', () => ({ resolveConditionalMedia: vi.fn() }))
vi.mock('@/lib/runtime/stream-response', () => ({ buildStructuredStreamResponse: vi.fn() }))

import { processStreaming } from '@/lib/runtime/runtime'
import { loadConversationContext } from '@/lib/conversation/context'
import { streamText } from 'ai'
import { trackAiUsage } from '@/lib/ai/cost'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveRecommendedProduct } from '@/lib/runtime/product-recommendation'
import { resolveConditionalMedia } from '@/lib/runtime/conditional-media'
import { buildStructuredStreamResponse } from '@/lib/runtime/stream-response'
import { FAKE_UUIDS, mockMessages } from '../fixtures'

const mockSystemPrompt = 'Eres un asistente de prueba.'
const mockUsedContext = [{ type: 'product', id: 'p1' }]

const mockStreamTextResult = {
  toTextStreamResponse: vi.fn(() => new Response()),
  textStream: {
    [Symbol.asyncIterator]: async function* () {
      yield 'texto'
    },
  },
}

const onFinishPayload = {
  text: 'respuesta simulada',
  usage: { inputTokens: 50, outputTokens: 20 },
  finishReason: 'stop' as const,
  warnings: [] as Array<unknown>,
  toolCalls: [] as Array<unknown>,
  toolResults: [] as Array<unknown>,
  response: { headers: {} as Record<string, string>, messages: [] as Array<unknown> },
  experimental_providerMetadata: undefined,
  warning: undefined,
  roundtrips: [] as Array<unknown>,
  steps: [] as Array<unknown>,
} as never

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

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(loadConversationContext).mockResolvedValue({
    systemPrompt: mockSystemPrompt,
    usedContext: mockUsedContext,
    fullAssistant: { id: FAKE_UUIDS.assistant },
    businessId: FAKE_UUIDS.business,
    assistantId: FAKE_UUIDS.assistant,
  })
  vi.mocked(streamText).mockReturnValue(mockStreamTextResult as never)
  vi.mocked(trackAiUsage).mockResolvedValue(undefined)
  vi.mocked(resolveRecommendedProduct).mockResolvedValue(null)
  vi.mocked(resolveConditionalMedia).mockResolvedValue(null)
  vi.mocked(buildStructuredStreamResponse).mockReturnValue(new Response())
})

describe('processStreaming', () => {
  const defaultParams = {
    assistantId: FAKE_UUIDS.assistant,
    businessId: FAKE_UUIDS.business,
    messages: mockMessages,
    requestType: 'training',
  }

  it('calls loadConversationContext with businessId and assistantId', async () => {
    await processStreaming(defaultParams)
    expect(loadConversationContext).toHaveBeenCalledWith(
      FAKE_UUIDS.business,
      FAKE_UUIDS.assistant,
      undefined,
      undefined,
      undefined,
      undefined,
      null,
      null,
      null,
      null
    )
  })

  it('calls streamText with messages and the system prompt', async () => {
    await processStreaming(defaultParams)
    expect(streamText).toHaveBeenCalledTimes(1)
    const callArgs = vi.mocked(streamText).mock.calls[0][0]
    expect(callArgs.messages).toBe(mockMessages)
    expect(callArgs.system).toBe(mockSystemPrompt)
  })

  it('returns a result compatible with toTextStreamResponse()', async () => {
    const result = await processStreaming(defaultParams)
    expect(typeof result.toTextStreamResponse).toBe('function')
    expect(typeof result.toStructuredStreamResponse).toBe('function')
    const response = result.toTextStreamResponse()
    expect(response).toBeInstanceOf(Response)
  })

  it('builds the structured stream with the resolved product', async () => {
    const product = {
      productId: FAKE_UUIDS.product1,
      name: 'Clean Nails',
      price: 45,
      imageUrl: null,
      description: null,
      benefits: null,
    }
    vi.mocked(resolveRecommendedProduct).mockResolvedValue(product)

    const result = await processStreaming({
      ...defaultParams,
      landingContext: { landingId: 'landing-0001', productId: FAKE_UUIDS.product1 },
    })

    expect(resolveRecommendedProduct).toHaveBeenCalledWith({
      businessId: FAKE_UUIDS.business,
      userMessage: mockMessages[mockMessages.length - 1].content,
      intentTag: null,
      productId: FAKE_UUIDS.product1,
    })
    result.toStructuredStreamResponse()
    expect(buildStructuredStreamResponse).toHaveBeenCalledWith({
      textStream: mockStreamTextResult.textStream,
      product,
      media: null,
    })
  })

  it('passes the channel to loadConversationContext and resolves conditional media', async () => {
    const { supabase, mockMaybeSingle } = makeMockSupabase()
    mockMaybeSingle.mockResolvedValueOnce({
      data: { customer_id: FAKE_UUIDS.customer },
      error: null,
    })
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    const media = {
      knowledgeItemId: 'item-media-1',
      imageUrl: 'https://abc123.supabase.co/storage/v1/object/public/knowledge-media/biz-1/img.jpg',
      mediaType: 'image' as const,
    }
    vi.mocked(resolveConditionalMedia).mockResolvedValue(media)

    const result = await processStreaming({
      ...defaultParams,
      conversationId: FAKE_UUIDS.conversation,
      channel: 'simulation',
    })
    result.toStructuredStreamResponse()

    expect(loadConversationContext).toHaveBeenCalledWith(
      FAKE_UUIDS.business,
      FAKE_UUIDS.assistant,
      FAKE_UUIDS.customer,
      'simulation',
      undefined,
      undefined,
      null,
      null,
      null,
      null
    )

    expect(resolveConditionalMedia).toHaveBeenCalledWith({
      businessId: FAKE_UUIDS.business,
      customerId: FAKE_UUIDS.customer,
      conversationId: FAKE_UUIDS.conversation,
      userMessage: mockMessages[mockMessages.length - 1].content,
      intentTag: null,
      productId: null,
      isResend: false,
    })

    expect(buildStructuredStreamResponse).toHaveBeenCalledWith(
      expect.objectContaining({ media: { imageUrl: media.imageUrl, mediaType: media.mediaType } })
    )
  })

  it('executes trackAiUsage via onFinish', async () => {
    await processStreaming(defaultParams)
    const onFinish = vi.mocked(streamText).mock.calls[0][0].onFinish!
    await onFinish(onFinishPayload)

    expect(trackAiUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        business_id: FAKE_UUIDS.business,
        assistant_id: FAKE_UUIDS.assistant,
        promptTokens: 50,
        completionTokens: 20,
        request_type: 'training',
      })
    )
  })

  it('persists messages when conversationId is provided', async () => {
    const { supabase, insertMock, mockMaybeSingle } = makeMockSupabase()
    mockMaybeSingle.mockResolvedValueOnce({
      data: { customer_id: FAKE_UUIDS.customer },
      error: null,
    })
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    await processStreaming({ ...defaultParams, conversationId: FAKE_UUIDS.conversation })
    const onFinish = vi.mocked(streamText).mock.calls[0][0].onFinish!
    await onFinish(onFinishPayload)

    expect(supabase.from).toHaveBeenCalledWith('messages')
    expect(insertMock).toHaveBeenCalledTimes(2)
    const userCall = insertMock.mock.calls[0][0] as Record<string, unknown>
    expect(userCall.role).toBe('user')
    expect(userCall.conversation_id).toBe(FAKE_UUIDS.conversation)
    const assistantCall = insertMock.mock.calls[1][0] as Record<string, unknown>
    expect(assistantCall.role).toBe('assistant')
    expect(assistantCall.conversation_id).toBe(FAKE_UUIDS.conversation)
  })

  it('persists metadata.product_id when a product is resolved', async () => {
    const { supabase, insertMock, mockMaybeSingle } = makeMockSupabase()
    mockMaybeSingle.mockResolvedValueOnce({
      data: { customer_id: FAKE_UUIDS.customer },
      error: null,
    })
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)
    vi.mocked(resolveRecommendedProduct).mockResolvedValue({
      productId: FAKE_UUIDS.product1,
      name: 'Clean Nails',
      price: 45,
      imageUrl: null,
      description: null,
      benefits: null,
    })

    await processStreaming({ ...defaultParams, conversationId: FAKE_UUIDS.conversation })
    const onFinish = vi.mocked(streamText).mock.calls[0][0].onFinish!
    await onFinish(onFinishPayload)

    const assistantCall = insertMock.mock.calls[1][0] as Record<string, unknown>
    expect(assistantCall.metadata).toEqual({
      used_context: mockUsedContext,
      product_id: FAKE_UUIDS.product1,
      product: {
        productId: FAKE_UUIDS.product1,
        name: 'Clean Nails',
        price: 45,
        imageUrl: null,
        description: null,
        benefits: null,
      },
    })
  })

  it('does NOT persist product_id when no product is resolved', async () => {
    const { supabase, insertMock, mockMaybeSingle } = makeMockSupabase()
    mockMaybeSingle.mockResolvedValueOnce({
      data: { customer_id: FAKE_UUIDS.customer },
      error: null,
    })
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    await processStreaming({ ...defaultParams, conversationId: FAKE_UUIDS.conversation })
    const onFinish = vi.mocked(streamText).mock.calls[0][0].onFinish!
    await onFinish(onFinishPayload)

    const assistantCall = insertMock.mock.calls[1][0] as Record<string, unknown>
    expect(assistantCall.metadata).toEqual({ used_context: mockUsedContext })
  })

  it('does NOT persist messages when conversationId is absent', async () => {
    const { supabase, insertMock } = makeMockSupabase()
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    await processStreaming(defaultParams)
    const onFinish = vi.mocked(streamText).mock.calls[0][0].onFinish!
    await onFinish(onFinishPayload)

    expect(insertMock).not.toHaveBeenCalled()
  })
})
