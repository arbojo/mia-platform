import { describe, it, expect, vi, beforeEach } from 'vitest'
import { streamText } from 'ai'
import { getOpenAIClient } from '@/lib/ai/client'
import { trackAiUsage } from '@/lib/ai/cost'

vi.mock('@ai-sdk/openai', () => ({ openai: vi.fn(() => 'mock-model') }))
vi.mock('ai', () => ({ streamText: vi.fn() }))
vi.mock('@/lib/ai/client', () => ({ getOpenAIClient: vi.fn(), MODEL: 'gpt-4o-mini' }))
vi.mock('@/lib/ai/cost', () => ({ trackAiUsage: vi.fn() }))

const { executeAI, AiExecutionError } = await import('@/lib/runtime/execute-ai')

const BASE_PARAMS = {
  businessId: 'business-1',
  assistantId: 'assistant-1',
  requestType: 'training',
  system: 'You are a helpful assistant.',
  messages: [{ role: 'user' as const, content: 'hello' }],
}

describe('executeAI', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('stream mode', () => {
    const mockStreamResult = {
      toTextStreamResponse: vi.fn(() => new Response()),
      toDataStreamResponse: vi.fn(),
    }
    const onFinishPayload = { text: 'respuesta', usage: { promptTokens: 10, completionTokens: 20 } }

    beforeEach(() => {
      vi.mocked(streamText).mockReturnValue(mockStreamResult as never)
    })

    it('calls streamText with system, messages, temperature, and onFinish', async () => {
      await executeAI({ ...BASE_PARAMS, mode: 'stream' })

      expect(streamText).toHaveBeenCalledOnce()
      expect(streamText).toHaveBeenCalledWith(expect.objectContaining({
        model: 'mock-model',
        system: BASE_PARAMS.system,
        messages: BASE_PARAMS.messages,
        temperature: 0.7,
      }))
      expect(vi.mocked(streamText).mock.calls[0][0]).toHaveProperty('onFinish')
    })

    it('returns the streamText result', async () => {
      const result = await executeAI({ ...BASE_PARAMS, mode: 'stream' })
      expect(result).toBe(mockStreamResult)
    })

    it('calls trackAiUsage when onFinish fires', async () => {
      await executeAI({ ...BASE_PARAMS, mode: 'stream' })

      const onFinish = vi.mocked(streamText).mock.calls[0][0].onFinish as (payload: typeof onFinishPayload) => Promise<void>
      await onFinish(onFinishPayload)

      expect(vi.mocked(trackAiUsage)).toHaveBeenCalledOnce()
      expect(vi.mocked(trackAiUsage)).toHaveBeenCalledWith({
        business_id: BASE_PARAMS.businessId,
        assistant_id: BASE_PARAMS.assistantId,
        promptTokens: 10,
        completionTokens: 20,
        request_type: BASE_PARAMS.requestType,
      })
    })

    it('calls external onFinish after trackAiUsage', async () => {
      const externalOnFinish = vi.fn()
      await executeAI({ ...BASE_PARAMS, mode: 'stream', onFinish: externalOnFinish })

      const onFinish = vi.mocked(streamText).mock.calls[0][0].onFinish as (payload: typeof onFinishPayload) => Promise<void>
      await onFinish(onFinishPayload)

      expect(vi.mocked(trackAiUsage)).toHaveBeenCalledBefore(externalOnFinish)
      expect(externalOnFinish).toHaveBeenCalledOnce()
      expect(externalOnFinish).toHaveBeenCalledWith(onFinishPayload)
    })
  })

  describe('complete mode', () => {
    const mockUsage = { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 }
    const mockCompletion = {
      id: 'cmpl-test',
      choices: [{ message: { content: 'respuesta completa' }, finish_reason: 'stop', index: 0 }],
      usage: mockUsage,
      model: 'gpt-4o-mini',
      object: 'chat.completion',
      created: 1234567890,
    }
    const mockCreate = vi.fn().mockResolvedValue(mockCompletion)

    beforeEach(() => {
      vi.mocked(getOpenAIClient).mockReturnValue({
        chat: { completions: { create: mockCreate } },
      } as never)
    })

    it('calls getOpenAIClient with system prompt prepended to messages', async () => {
      await executeAI({ ...BASE_PARAMS, mode: 'complete' })

      expect(mockCreate).toHaveBeenCalledOnce()
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: BASE_PARAMS.system },
          ...BASE_PARAMS.messages,
        ],
        max_tokens: 500,
        temperature: 0.7,
      }))
    })

    it('returns content and usage', async () => {
      const result = await executeAI({ ...BASE_PARAMS, mode: 'complete' })

      expect(result).toEqual({
        content: 'respuesta completa',
        usage: { promptTokens: 50, completionTokens: 20 },
      })
    })

    it('calls trackAiUsage with correct values', async () => {
      await executeAI({ ...BASE_PARAMS, mode: 'complete' })

      expect(vi.mocked(trackAiUsage)).toHaveBeenCalledOnce()
      expect(vi.mocked(trackAiUsage)).toHaveBeenCalledWith({
        business_id: BASE_PARAMS.businessId,
        assistant_id: BASE_PARAMS.assistantId,
        promptTokens: 50,
        completionTokens: 20,
        request_type: BASE_PARAMS.requestType,
      })
    })

    it('calls external onFinish with content and usage', async () => {
      const externalOnFinish = vi.fn()
      await executeAI({ ...BASE_PARAMS, mode: 'complete', onFinish: externalOnFinish })

      expect(externalOnFinish).toHaveBeenCalledOnce()
      expect(externalOnFinish).toHaveBeenCalledWith({
        text: 'respuesta completa',
        usage: { promptTokens: 50, completionTokens: 20 },
      })
    })

    it('handles empty response from API', async () => {
      const emptyCompletion = {
        ...mockCompletion,
        choices: [{ message: { content: null }, finish_reason: 'stop', index: 0 }],
      }
      mockCreate.mockResolvedValueOnce(emptyCompletion)

      const result = await executeAI({ ...BASE_PARAMS, mode: 'complete' })
      expect(result.content).toBe('')
    })

    it('handles missing usage from API', async () => {
      const noUsageCompletion = { ...mockCompletion, usage: undefined }
      mockCreate.mockResolvedValueOnce(noUsageCompletion)

      const result = await executeAI({ ...BASE_PARAMS, mode: 'complete' })
      expect(result.usage).toEqual({ promptTokens: 0, completionTokens: 0 })
    })

    it('accepts custom maxTokens', async () => {
      await executeAI({ ...BASE_PARAMS, mode: 'complete', maxTokens: 100 })

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        max_tokens: 100,
      }))
    })

    it('accepts custom temperature', async () => {
      await executeAI({ ...BASE_PARAMS, mode: 'complete', temperature: 0.9 })

      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
        temperature: 0.9,
      }))
    })
  })

  describe('AiExecutionError', () => {
    it('has name, code, and statusCode', () => {
      const err = new AiExecutionError('test error', 'TEST_ERROR', 400)
      expect(err).toBeInstanceOf(Error)
      expect(err.name).toBe('AiExecutionError')
      expect(err.message).toBe('test error')
      expect(err.code).toBe('TEST_ERROR')
      expect(err.statusCode).toBe(400)
    })

    it('defaults statusCode to 500', () => {
      const err = new AiExecutionError('server error', 'SERVER_ERROR')
      expect(err.statusCode).toBe(500)
    })
  })
})
