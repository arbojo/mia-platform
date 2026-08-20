import { streamText, generateText, type AsyncIterableStream } from 'ai'
import { getProviderModelWithFallback, type AITaskType } from '@/lib/ai/task-routing'
import { trackAiUsage } from '@/lib/ai/cost'

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
  onFinish?: ExecuteAIParams['onFinish']
}): Promise<CompleteResult> {
  const { model, modelName, system, messages, maxTokens, temperature, responseFormat, businessId, assistantId, requestType, onFinish: externalOnFinish } = params

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

  if (externalOnFinish) {
    await externalOnFinish({ text: result.text, usage: { promptTokens, completionTokens } })
  }

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
    onFinish: externalOnFinish,
  }

  if (mode === 'stream') {
    try {
      return await executeStream({
        model: primary.model,
        modelName: primary.modelName,
        ...sharedParams,
      })
    } catch (error) {
      if (isRateLimitError(error) && fallback) {
        console.warn(`[AI Router] ${primary.modelName} rate limited, falling back to ${fallback.modelName}`)
        return await executeStream({
          model: fallback.model,
          modelName: fallback.modelName,
          ...sharedParams,
        })
      }
      throw error
    }
  }

  try {
    return await executeComplete({
      model: primary.model,
      modelName: primary.modelName,
      maxTokens,
      responseFormat,
      ...sharedParams,
    })
  } catch (error) {
    if (isRateLimitError(error) && fallback) {
      console.warn(`[AI Router] ${primary.modelName} rate limited, falling back to ${fallback.modelName}`)
      return await executeComplete({
        model: fallback.model,
        modelName: fallback.modelName,
        maxTokens,
        responseFormat,
        ...sharedParams,
      })
    }
    throw error
  }
}
