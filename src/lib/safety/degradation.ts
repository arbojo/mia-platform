import { logPendingAiSignal } from './events'
import type { SafetyContext, SafetyTrigger } from './types'

export async function handleDegradation(params: {
  businessId: string
  assistantId: string
  originalResponse: string
  triggers: SafetyTrigger[]
}): Promise<string> {
  await logPendingAiSignal({
    businessId: params.businessId,
    assistantId: params.assistantId,
    originalResponse: params.originalResponse,
    triggers: params.triggers,
  })

  return 'Déjame confirmar ese dato para darte información correcta 😊'
}
