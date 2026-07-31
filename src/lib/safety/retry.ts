import { getOpenAIClient, MODEL } from '@/lib/ai/client'
import { trackAiUsage } from '@/lib/ai/cost'
import type { ChatCompletionMessageParam } from 'openai/resources'
import type { SafetyContext, SafetyResult } from './types'
import { validateAIResponse } from './validator'
import { scanTriggers } from './triggers'

const MAX_RETRIES = 1
const RETRY_DELAY = 2000

const SAFETY_SYSTEM_PROMPT = `Eres un asistente de ventas mexicano.

El dueño del negocio ha notado que la respuesta que generaste contiene información INCORRECTA sobre precios, entregas, garantías o descuentos.
NO repitas la información incorrecta.
Si mencionaste un precio, entrégalo correctamente o elimínalo.
Si mencionaste tiempos de entrega, corrígelos o elimínalos.
Si mencionaste garantías o políticas de devolución, corrígelas o elimínalas.
Si mencionaste descuentos, corrígelos o elimínalos.
NO inventes información que no esté confirmada.
Mantén el mismo tono y estilo de tu respuesta original.
NO le digas al cliente que cometiste un error. Simplemente da la información correcta o reformula sin los datos incorrectos.`

export async function retryWithSafety(
  originalResponse: string,
  conversationHistory: ChatCompletionMessageParam[],
  context: SafetyContext,
  businessId: string,
  assistantId: string
): Promise<SafetyResult> {
  const triggers = scanTriggers(originalResponse)

  await delay(RETRY_DELAY)

  const safetyMessages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SAFETY_SYSTEM_PROMPT },
    ...conversationHistory.slice(-6),
    { role: 'assistant', content: originalResponse },
  ]

  try {
    const completion = await getOpenAIClient().chat.completions.create({
      model: MODEL,
      messages: safetyMessages,
      max_tokens: 500,
    })

    const corrected = completion.choices[0]?.message?.content ?? ''

    await trackAiUsage({
      business_id: businessId,
      assistant_id: assistantId,
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
      request_type: 'safety_retry',
    })

    const result = await validateAIResponse(corrected, context)

    return {
      passed: result.passed,
      triggers: result.triggers,
      blocked: result.blocked,
      retriesAttempted: 1,
      finalResponse: result.passed ? corrected : originalResponse,
    }
  } catch {
    return {
      passed: true,
      triggers,
      blocked: false,
      retriesAttempted: 1,
      finalResponse: originalResponse,
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
