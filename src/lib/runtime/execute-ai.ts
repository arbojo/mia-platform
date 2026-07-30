import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { getOpenAIClient, MODEL } from '@/lib/ai/client'
import { trackAiUsage } from '@/lib/ai/cost'

export type AIMode = 'stream' | 'complete'

export interface ExecuteAIParams {
  mode: AIMode
  businessId: string
  assistantId: string
  requestType: string
  system: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  maxTokens?: number
  temperature?: number
  onFinish?: (result: { text: string; usage: { promptTokens: number; completionTokens: number } }) => Promise<void>
}

export interface StreamResult {
  toTextStreamResponse(): Response
  toDataStreamResponse(): Response
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

export async function executeAI(params: ExecuteAIParams & { mode: 'stream' }): Promise<StreamResult>
export async function executeAI(params: ExecuteAIParams & { mode: 'complete' }): Promise<CompleteResult>
export async function executeAI(params: ExecuteAIParams): Promise<ExecuteAIResult> {
  const { mode, businessId, assistantId, requestType, system, messages, maxTokens, temperature, onFinish: externalOnFinish } = params

  if (mode === 'stream') {
    const result = streamText({
      model: openai(MODEL),
      system,
      messages,
      temperature: temperature ?? 0.7,
      onFinish: async ({ usage, text }) => {
        const u = usage as { promptTokens?: number; completionTokens?: number }
        const promptTokens = u.promptTokens ?? 0
        const completionTokens = u.completionTokens ?? 0

        await trackAiUsage({
          business_id: businessId,
          assistant_id: assistantId,
          promptTokens,
          completionTokens,
          request_type: requestType,
        })

        if (externalOnFinish) {
          await externalOnFinish({ text, usage: { promptTokens, completionTokens } })
        }
      },
    })

    return result as unknown as StreamResult
  }

  const messagesWithSystem: Array<{ role: string; content: string }> = [
    { role: 'system', content: system },
    ...messages,
  ]

  const completion = await getOpenAIClient().chat.completions.create({
    model: MODEL,
    messages: messagesWithSystem as never,
    max_tokens: maxTokens ?? 500,
    temperature: temperature ?? 0.7,
  })

  const content = completion.choices[0]?.message?.content ?? ''
  const promptTokens = completion.usage?.prompt_tokens ?? 0
  const completionTokens = completion.usage?.completion_tokens ?? 0

  await trackAiUsage({
    business_id: businessId,
    assistant_id: assistantId,
    promptTokens,
    completionTokens,
    request_type: requestType,
  })

  if (externalOnFinish) {
    await externalOnFinish({ text: content, usage: { promptTokens, completionTokens } })
  }

  return {
    content,
    usage: { promptTokens, completionTokens },
  }
}
