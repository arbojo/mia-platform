import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@ai-sdk/openai', () => ({ openai: vi.fn(() => ({})) }))
vi.mock('ai', () => ({ streamText: vi.fn() }))
vi.mock('@/lib/conversation/context', () => ({ loadConversationContext: vi.fn() }))
vi.mock('@/lib/ai/cost', () => ({ trackAiUsage: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

import { processStreaming } from '@/lib/runtime/runtime'
import { loadConversationContext } from '@/lib/conversation/context'
import { streamText } from 'ai'
import { trackAiUsage } from '@/lib/ai/cost'
import { createAdminClient } from '@/lib/supabase/admin'
import { FAKE_UUIDS, mockMessages } from '../fixtures'

const mockSystemPrompt = 'Eres un asistente de prueba.'
const mockUsedContext = [{ type: 'product', id: 'p1' }]

const mockStreamTextResult = {
  toTextStreamResponse: vi.fn(() => new Response()),
  toDataStreamResponse: vi.fn(),
}

const onFinishPayload = {
  text: 'respuesta simulada',
  usage: { promptTokens: 50, completionTokens: 20 },
  finishReason: 'stop' as const,
  warnings: [] as Array<unknown>,
  toolCalls: [] as Array<unknown>,
  toolResults: [] as Array<unknown>,
  response: { headers: {} as Record<string, string>, messages: [] as Array<unknown> },
  experimental_providerMetadata: undefined,
  warning: undefined,
  roundtrips: [] as Array<unknown>,
  steps: [] as Array<unknown>,
}

function makeMockSupabase() {
  const insertMock = vi.fn(() => Promise.resolve({ data: null, error: null }))
  const mockMaybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }))
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve({ data: [], error: null })),
    insert: insertMock,
    maybeSingle: mockMaybeSingle,
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
      undefined
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
    expect(result).toBe(mockStreamTextResult)
    expect(typeof result.toTextStreamResponse).toBe('function')
    const response = result.toTextStreamResponse()
    expect(response).toBeInstanceOf(Response)
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

  it('does NOT persist messages when conversationId is absent', async () => {
    const { supabase, insertMock } = makeMockSupabase()
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    await processStreaming(defaultParams)
    const onFinish = vi.mocked(streamText).mock.calls[0][0].onFinish!
    await onFinish(onFinishPayload)

    expect(insertMock).not.toHaveBeenCalled()
  })
})
