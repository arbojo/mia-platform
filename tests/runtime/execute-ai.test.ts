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

  describe('guard de seguridad de la respuesta', () => {
    const DERIVA = 'Lo mejor sería consultar a un profesional de la salud antes de decidir.'
    const CORREGIDA = 'Como tú ya conoces tu situación, te doy el Neurotin. No es un tratamiento médico.'
    const CLAIM = 'Con estos calcetines curas la neuropatía y es totalmente seguro.'
    const CORREGIDA_CLAIM = 'Te doy el Neurotin para el apoyo del día a día. No es un tratamiento médico.'

    const CHRONIC = {
      messages: [{ role: 'user' as const, content: 'Tengo neuropatía diabética, ¿me serviría?' }],
    }

    beforeEach(() => {
      vi.mocked(generateText).mockResolvedValue({
        text: CORREGIDA,
        usage: { inputTokens: 10, outputTokens: 20 },
      } as never)
    })

    it('sin el flag NO reintenta aunque el modelo derive', async () => {
      vi.mocked(generateText).mockResolvedValueOnce({
        text: DERIVA,
        usage: { inputTokens: 10, outputTokens: 20 },
      } as never)

      const result = await executeAI({ ...BASE_PARAMS, ...CHRONIC, mode: 'complete' })

      expect(generateText).toHaveBeenCalledOnce()
      expect(result.content).toBe(DERIVA)
    })

    it('con el flag reintenta UNA vez y devuelve la versión corregida', async () => {
      vi.mocked(generateText)
        .mockResolvedValueOnce({ text: DERIVA, usage: { inputTokens: 10, outputTokens: 20 } } as never)
        .mockResolvedValueOnce({ text: CORREGIDA, usage: { inputTokens: 12, outputTokens: 18 } } as never)

      const result = await executeAI({
        ...BASE_PARAMS,
        ...CHRONIC,
        mode: 'complete',
        safetyGuard: true,
      })

      expect(generateText).toHaveBeenCalledTimes(2)
      expect(result.content).toBe(CORREGIDA)
    })

    it('el reintento envía la corrección como último turno de usuario', async () => {
      vi.mocked(generateText)
        .mockResolvedValueOnce({ text: DERIVA, usage: { inputTokens: 10, outputTokens: 20 } } as never)
        .mockResolvedValueOnce({ text: CORREGIDA, usage: { inputTokens: 12, outputTokens: 18 } } as never)

      await executeAI({ ...BASE_PARAMS, ...CHRONIC, mode: 'complete', safetyGuard: true })

      const retryMessages = vi.mocked(generateText).mock.calls[1][0].messages ?? []
      expect(retryMessages).toHaveLength(3)
      expect(retryMessages[1]).toEqual({ role: 'assistant', content: DERIVA })
      expect(retryMessages[2].role).toBe('user')
      expect(retryMessages[2].content).toMatch(/no le digas que consulte/i)
    })

    it('no reintenta dos veces: un solo reintento aunque la derivación persista', async () => {
      vi.mocked(generateText).mockResolvedValue({ text: DERIVA, usage: { inputTokens: 10, outputTokens: 20 } } as never)

      const result = await executeAI({
        ...BASE_PARAMS,
        ...CHRONIC,
        mode: 'complete',
        safetyGuard: true,
      })

      expect(generateText).toHaveBeenCalledTimes(2)
      // No se entrega un texto truncado: se devuelve lo que el modelo dio.
      expect(result.content).toBe(DERIVA)
    })

    it('onFinish se dispara UNA sola vez, con el texto final', async () => {
      vi.mocked(generateText)
        .mockResolvedValueOnce({ text: DERIVA, usage: { inputTokens: 10, outputTokens: 20 } } as never)
        .mockResolvedValueOnce({ text: CORREGIDA, usage: { inputTokens: 12, outputTokens: 18 } } as never)
      const onFinish = vi.fn().mockResolvedValue(undefined)

      await executeAI({
        ...BASE_PARAMS,
        ...CHRONIC,
        mode: 'complete',
        safetyGuard: true,
        onFinish,
      })

      expect(onFinish).toHaveBeenCalledOnce()
      expect(onFinish).toHaveBeenCalledWith({ text: CORREGIDA, usage: { promptTokens: 12, completionTokens: 18 } })
    })

    it('el reintento también queda registrado en el uso de tokens', async () => {
      vi.mocked(generateText)
        .mockResolvedValueOnce({ text: DERIVA, usage: { inputTokens: 10, outputTokens: 20 } } as never)
        .mockResolvedValueOnce({ text: CORREGIDA, usage: { inputTokens: 12, outputTokens: 18 } } as never)

      await executeAI({ ...BASE_PARAMS, ...CHRONIC, mode: 'complete', safetyGuard: true })

      expect(trackAiUsage).toHaveBeenCalledTimes(2)
    })

    it('INTERLOCK: con síntomas agudos NO reintenta aunque el modelo derive', async () => {
      vi.mocked(generateText).mockResolvedValue({ text: DERIVA, usage: { inputTokens: 10, outputTokens: 20 } } as never)

      const result = await executeAI({
        ...BASE_PARAMS,
        messages: [{ role: 'user', content: 'Me duele el pecho y no puedo respirar' }],
        mode: 'complete',
        safetyGuard: true,
      })

      expect(generateText).toHaveBeenCalledOnce()
      expect(result.content).toBe(DERIVA)
    })

    it('no aplica en responseFormat json', async () => {
      vi.mocked(generateText).mockResolvedValue({ text: DERIVA, usage: { inputTokens: 10, outputTokens: 20 } } as never)

      await executeAI({
        ...BASE_PARAMS,
        ...CHRONIC,
        mode: 'complete',
        safetyGuard: true,
        responseFormat: 'json',
      })

      expect(generateText).toHaveBeenCalledOnce()
    })

    it('una respuesta limpia no cuesta una llamada extra', async () => {
      const result = await executeAI({
        ...BASE_PARAMS,
        ...CHRONIC,
        mode: 'complete',
        safetyGuard: true,
      })

      expect(generateText).toHaveBeenCalledOnce()
      expect(result.content).toBe(CORREGIDA)
    })

    it('reintenta también cuando la violación es un CLAIM, no una derivación', async () => {
      // El guard nació para las derivaciones. Si solo cubriera esas, el banco de
      // regresión seguiría deixando pasar "este parche cura".
      vi.mocked(generateText)
        .mockResolvedValueOnce({ text: CLAIM, usage: { inputTokens: 10, outputTokens: 20 } } as never)
        .mockResolvedValueOnce({ text: CORREGIDA_CLAIM, usage: { inputTokens: 12, outputTokens: 18 } } as never)

      const result = await executeAI({
        ...BASE_PARAMS,
        ...CHRONIC,
        mode: 'complete',
        safetyGuard: true,
      })

      expect(generateText).toHaveBeenCalledTimes(2)
      expect(result.content).toBe(CORREGIDA_CLAIM)
    })

    it('la corrección de un claim NO propone derivar', async () => {
      // La trampa de extender el guard: si el reintento solo dice "no afirmes
      // que cura", el modelo puede "arreglarlo" mandando al cliente al médico,
      // que es la otra prohibición.
      vi.mocked(generateText)
        .mockResolvedValueOnce({ text: CLAIM, usage: { inputTokens: 10, outputTokens: 20 } } as never)
        .mockResolvedValueOnce({ text: CORREGIDA_CLAIM, usage: { inputTokens: 12, outputTokens: 18 } } as never)

      await executeAI({ ...BASE_PARAMS, ...CHRONIC, mode: 'complete', safetyGuard: true })

      const correction = (vi.mocked(generateText).mock.calls[1][0].messages ?? []).at(-1)?.content
      expect(correction).toMatch(/no resuelvas esto mandándolo al médico/i)
    })

    it('un claim no dispara el guard cuando el flag está apagado', async () => {
      vi.mocked(generateText).mockResolvedValueOnce({ text: CLAIM, usage: { inputTokens: 10, outputTokens: 20 } } as never)

      const result = await executeAI({ ...BASE_PARAMS, ...CHRONIC, mode: 'complete' })

      expect(generateText).toHaveBeenCalledOnce()
      expect(result.content).toBe(CLAIM)
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
