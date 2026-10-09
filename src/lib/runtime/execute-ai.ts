import { streamText, generateText, type AsyncIterableStream } from 'ai'
import { getProviderModelWithFallback, type AITaskType } from '@/lib/ai/task-routing'
import { trackAiUsage } from '@/lib/ai/cost'
import {
  buildSafetyCorrectionPrompt,
  customerTextFrom,
  decideSafetyGuard,
  findSafetyViolations,
} from './safety-guard'

export type AIMode = 'stream' | 'complete'

export interface ExecuteAIParams {
  mode: AIMode
  taskType?: AITaskType
  businessId: string
  assistantId: string
  requestType: string
  system: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  maxTokens?: number
  temperature?: number
  responseFormat?: 'text' | 'json'
  /**
   * Corrige, con un reintento, las violaciones de seguridad de la respuesta:
   * derivación al médico y claims de salud no sustentados. Opt-in: solo los call
   * sites de venta al cliente lo activan. Ver `safety-guard.ts`.
   */
  safetyGuard?: boolean
  onFinish?: (result: { text: string; usage: { promptTokens: number; completionTokens: number } }) => Promise<void>
}

export interface StreamResult {
  toTextStreamResponse(): Response
  textStream: AsyncIterableStream<string>
}

export interface CompleteResult {
  content: string
  usage: { promptTokens: number; completionTokens: number }
}

export type ExecuteAIResult = StreamResult | CompleteResult

export class AiExecutionError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'AiExecutionError'
  }
}

function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as Record<string, unknown>
  if (typeof e.status === 'number' && e.status === 429) return true
  if (typeof e.message === 'string' && e.message.toLowerCase().includes('rate limit')) return true
  if (typeof e.message === 'string' && e.message.toLowerCase().includes('429')) return true
  return false
}

async function executeStream(params: {
  model: ReturnType<typeof import('@/lib/ai/task-routing').getProviderModelWithFallback>['primary']['model']
  modelName: string
  system: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  temperature: number
  businessId: string
  assistantId: string
  requestType: string
  onFinish?: ExecuteAIParams['onFinish']
}): Promise<StreamResult> {
  const { model, modelName, system, messages, temperature, businessId, assistantId, requestType, onFinish: externalOnFinish } = params

  const result = streamText({
    model,
    system,
    messages,
    temperature,
    onFinish: async ({ usage, text }) => {
      const u = usage as { inputTokens?: number; outputTokens?: number }
      const promptTokens = u.inputTokens ?? 0
      const completionTokens = u.outputTokens ?? 0

      await trackAiUsage({
        business_id: businessId,
        assistant_id: assistantId,
        promptTokens,
        completionTokens,
        model: modelName,
        request_type: requestType,
      })

      if (externalOnFinish) {
        await externalOnFinish({ text, usage: { promptTokens, completionTokens } })
      }
    },
  })

  return result as unknown as StreamResult
}

async function executeComplete(params: {
  model: ReturnType<typeof import('@/lib/ai/task-routing').getProviderModelWithFallback>['primary']['model']
  modelName: string
  system: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  maxTokens: number
  temperature: number
  responseFormat?: 'text' | 'json'
  businessId: string
  assistantId: string
  requestType: string
}): Promise<CompleteResult> {
  const { model, modelName, system, messages, maxTokens, temperature, responseFormat, businessId, assistantId, requestType } = params

  const result = await generateText({
    model,
    system,
    messages,
    maxOutputTokens: maxTokens,
    temperature,
    ...(responseFormat === 'json' ? { responseFormat: { type: 'json' } as never } : {}),
  })

  const promptTokens = result.usage.inputTokens ?? 0
  const completionTokens = result.usage.outputTokens ?? 0

  await trackAiUsage({
    business_id: businessId,
    assistant_id: assistantId,
    promptTokens,
    completionTokens,
    model: modelName,
    request_type: requestType,
  })

  return {
    content: result.text,
    usage: { promptTokens, completionTokens },
  }
}

export async function executeAI(params: ExecuteAIParams & { mode: 'stream' }): Promise<StreamResult>
export async function executeAI(params: ExecuteAIParams & { mode: 'complete' }): Promise<CompleteResult>
export async function executeAI(params: ExecuteAIParams): Promise<ExecuteAIResult> {
  const {
    mode,
    taskType = 'chat',
    businessId,
    assistantId,
    requestType,
    system,
    messages,
    maxTokens = 500,
    temperature = 0.7,
    responseFormat,
    safetyGuard = false,
    onFinish: externalOnFinish,
  } = params

  const { primary, fallback } = getProviderModelWithFallback(taskType)

  const sharedParams = {
    system,
    messages,
    temperature,
    businessId,
    assistantId,
    requestType,
  }

  if (mode === 'stream') {
    const streamParams = { ...sharedParams, onFinish: externalOnFinish }
    try {
      return await executeStream({
        model: primary.model,
        modelName: primary.modelName,
        ...streamParams,
      })
    } catch (error) {
      if (isRateLimitError(error) && fallback) {
        console.warn(`[AI Router] ${primary.modelName} rate limited, falling back to ${fallback.modelName}`)
        return await executeStream({
          model: fallback.model,
          modelName: fallback.modelName,
          ...streamParams,
        })
      }
      throw error
    }
  }

  const completeParams = { ...sharedParams, maxTokens, responseFormat }

  /** Un intento, con el mismo manejo de rate-limit/fallback que el camino normal. */
  const attempt = (attemptMessages: typeof messages) => {
    const withMessages = { ...completeParams, messages: attemptMessages }
    return (async () => {
      try {
        return await executeComplete({ model: primary.model, modelName: primary.modelName, ...withMessages })
      } catch (error) {
        if (isRateLimitError(error) && fallback) {
          console.warn(`[AI Router] ${primary.modelName} rate limited, falling back to ${fallback.modelName}`)
          return await executeComplete({
            model: fallback.model,
            modelName: fallback.modelName,
            ...withMessages,
          })
        }
        throw error
      }
    })()
  }

  let result = await attempt(messages)

  // ── Guard de derivación al médico (determinístico en su decisión, una llamada
  //    extra solo cuando el modelo se equivocó) ───────────────────────────────
  // No aplica en JSON (una respuesta de evaluación no es un turno de venta) ni
  // cuando el cliente describió síntomas agudos: ahí derivar es lo correcto.
  const guard = decideSafetyGuard({
    enabled: safetyGuard && responseFormat !== 'json',
    customerText: customerTextFrom(messages),
  })

  if (guard.apply) {
    const violations = findSafetyViolations(result.content)

    if (violations.length > 0) {
      console.warn(
        `[SafetyGuard] ${violations.length} violación(es): ${violations.map((v) => `${v.kind}:${v.id}`).join(', ')}; reintentando con corrección`,
      )
      result = await attempt([
        ...messages,
        { role: 'assistant', content: result.content },
        { role: 'user', content: buildSafetyCorrectionPrompt(violations) },
      ])

      const restantes = findSafetyViolations(result.content)
      if (restantes.length > 0) {
        // Un reintento y nada. No se insiste: el texto devuelto es el mejor que
        // tenemos y truncar la respuesta delataría el mecanismo al cliente.
        console.error(
          `[SafetyGuard] persisten ${restantes.length} violación(es) tras el reintento: ${restantes.map((v) => `${v.kind}:${v.id}`).join(', ')}`,
        )
      }
    }
  }

  // `onFinish` se dispara UNA vez, con el texto final. Por eso no se pasa a
  // `executeComplete`: si el guard reintenta, un `onFinish` por intento
  // persistiría dos veces el mismo turno.
  if (externalOnFinish) {
    await externalOnFinish({ text: result.content, usage: result.usage })
  }

  return result
}
