import { describe, it, expect, vi, beforeEach } from 'vitest'
import { streamText, generateText } from 'ai'
import { getProviderModelWithFallback } from '@/lib/ai/task-routing'
import { trackAiUsage } from '@/lib/ai/cost'

vi.mock('ai', () => ({ streamText: vi.fn(), generateText: vi.fn() }))
vi.mock('@/lib/ai/task-routing', () => ({ getProviderModelWithFallback: vi.fn() }))
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
    vi.mocked(getProviderModelWithFallback).mockReturnValue({
      primary: { model: 'mock-model' as never, modelName: 'gpt-4o-mini' },
      fallback: null,
    })
  })

  describe('stream mode', () => {
    const mockStreamResult = {
      toTextStreamResponse: vi.fn(() => new Response()),
      textStream: {
        [Symbol.asyncIterator]: async function* () {
          yield 'respuesta'
        },
      },
    }
    const onFinishPayload = {
      text: 'respuesta',
      usage: { inputTokens: 10, outputTokens: 20 },
    }

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

      const onFinish = vi.mocked(streamText).mock.calls[0][0].onFinish as unknown as (payload: typeof onFinishPayload) => Promise<void>
      await onFinish(onFinishPayload)

      expect(vi.mocked(trackAiUsage)).toHaveBeenCalledOnce()
      expect(vi.mocked(trackAiUsage)).toHaveBeenCalledWith({
        business_id: BASE_PARAMS.businessId,
        assistant_id: BASE_PARAMS.assistantId,
        promptTokens: 10,
        completionTokens: 20,
        model: 'gpt-4o-mini',
        request_type: BASE_PARAMS.requestType,
      })
    })

    it('calls external onFinish after trackAiUsage', async () => {
      const externalOnFinish = vi.fn()
      await executeAI({ ...BASE_PARAMS, mode: 'stream', onFinish: externalOnFinish })

      const onFinish = vi.mocked(streamText).mock.calls[0][0].onFinish as unknown as (payload: typeof onFinishPayload) => Promise<void>
      await onFinish(onFinishPayload)

      expect(vi.mocked(trackAiUsage)).toHaveBeenCalledBefore(externalOnFinish)
      expect(externalOnFinish).toHaveBeenCalledOnce()
      expect(externalOnFinish).toHaveBeenCalledWith({
        text: 'respuesta',
        usage: { promptTokens: 10, completionTokens: 20 },
      })
    })
  })

  describe('complete mode', () => {
    const mockGenerate = vi.fn()

    beforeEach(() => {
      mockGenerate.mockResolvedValue({
        text: 'respuesta completa',
        usage: { inputTokens: 50, outputTokens: 20 },
      })
      vi.mocked(generateText).mockImplementation(mockGenerate as never)
    })

    it('calls generateText with system, messages, maxOutputTokens and temperature', async () => {
      await executeAI({ ...BASE_PARAMS, mode: 'complete' })

      expect(generateText).toHaveBeenCalledOnce()
      expect(generateText).toHaveBeenCalledWith(expect.objectContaining({
        model: 'mock-model',
        system: BASE_PARAMS.system,
        messages: BASE_PARAMS.messages,
        maxOutputTokens: 500,
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
        model: 'gpt-4o-mini',
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
      mockGenerate.mockResolvedValueOnce({
        text: '',
        usage: { inputTokens: 50, outputTokens: 20 },
      })

      const result = await executeAI({ ...BASE_PARAMS, mode: 'complete' })
      expect(result.content).toBe('')
    })

    it('defaults missing token counts to zero', async () => {
      mockGenerate.mockResolvedValueOnce({
        text: 'respuesta completa',
        usage: {},
      })

      const result = await executeAI({ ...BASE_PARAMS, mode: 'complete' })
      expect(result.usage).toEqual({ promptTokens: 0, completionTokens: 0 })
    })

    it('accepts custom maxTokens', async () => {
      await executeAI({ ...BASE_PARAMS, mode: 'complete', maxTokens: 100 })

      expect(generateText).toHaveBeenCalledWith(expect.objectContaining({
        maxOutputTokens: 100,
      }))
    })

    it('accepts custom temperature', async () => {
      await executeAI({ ...BASE_PARAMS, mode: 'complete', temperature: 0.9 })

      expect(generateText).toHaveBeenCalledWith(expect.objectContaining({
        temperature: 0.9,
      }))
    })

    it('falls back to the secondary provider on rate limit', async () => {
      vi.mocked(getProviderModelWithFallback).mockReturnValue({
        primary: { model: 'mock-primary' as never, modelName: 'gpt-4o-mini' },
        fallback: { model: 'mock-fallback' as never, modelName: 'deepseek-chat' },
      })
      mockGenerate
        .mockRejectedValueOnce(Object.assign(new Error('rate limit exceeded'), { status: 429 }))
        .mockResolvedValueOnce({
          text: 'respuesta de fallback',
          usage: { inputTokens: 5, outputTokens: 5 },
        })

      const result = await executeAI({ ...BASE_PARAMS, mode: 'complete' })

      expect(generateText).toHaveBeenCalledTimes(2)
      expect(vi.mocked(generateText).mock.calls[1][0]).toHaveProperty('model', 'mock-fallback')
      expect(result.content).toBe('respuesta de fallback')
      expect(vi.mocked(trackAiUsage)).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'deepseek-chat' })
      )
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
