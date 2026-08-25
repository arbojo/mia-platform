import { createAdminClient } from '@/lib/supabase/admin'
import { createEvidenceItem, type EvidenceItem, type EvidenceType } from '@/lib/reasoning/evidence'
import { computeCustomerState, createInitialState } from '@/lib/reasoning/state'
import { getCustomerMemory } from '@/lib/ai/customer-memory'
import { mergeEvidenceItems } from '@/lib/reasoning/evidence'

export interface EvidenceExtractionParams {
  customerId: string
  conversationId: string
  message: string
  messageId: string
}

const INTEREST_SIGNALS = [
  /cuánto cuesta/i,
  /cuanto cuesta/i,
  /precio/i,
  /me interesa/i,
  /me gusta/i,
  /quiero/i,
  /necesito/i,
  /cuándo/i,
  /cuando/i,
  /envío/i,
  /envio/i,
  /enviar/i,
  /disponible/i,
]

const TRUST_SIGNALS = [
  /gracias/i,
  /perfecto/i,
  /entiendo/i,
  /de acuerdo/i,
  /claro/i,
  /ok/i,
  /bien/i,
]

const READINESS_SIGNALS = [
  /quiero uno/i,
  /lo llevo/i,
  /comprar/i,
  /pagar/i,
  /dirección/i,
  /direccion/i,
  /teléfono/i,
  /telefono/i,
  /cuánto/i,
  /cuanto/i,
  /formas de pago/i,
]

const HESITATION_SIGNALS = [
  /no sé/i,
  /no se/i,
  /tal vez/i,
  /después/i,
  /despues/i,
  /quizás/i,
  /aún no/i,
  /aun no/i,
  /dudando/i,
]

const OBJECTION_SIGNALS = [
  /caro/i,
  /no puedo/i,
  /pero/i,
  /sin embargo/i,
  /el problema/i,
  /no me convence/i,
  /me preocupa/i,
  /y si/i,
]

const CONFUSION_SIGNALS = [
  /no entiendo/i,
  /no comprendo/i,
  /cómo/i,
  /como/i,
  /qué significa/i,
  /que significa/i,
  /explícame/i,
  /explicame/i,
]

function classifySignals(text: string): Array<{ type: EvidenceType; weight: number; confidence: number }> {
  const signals: Array<{ type: EvidenceType; weight: number; confidence: number }> = []

  for (const pattern of INTEREST_SIGNALS) {
    if (pattern.test(text)) {
      signals.push({ type: 'interest', weight: 0.6, confidence: 0.7 })
      break
    }
  }

  for (const pattern of TRUST_SIGNALS) {
    if (pattern.test(text)) {
      signals.push({ type: 'trust', weight: 0.4, confidence: 0.6 })
      break
    }
  }

  for (const pattern of READINESS_SIGNALS) {
    if (pattern.test(text)) {
      signals.push({ type: 'readiness', weight: 0.7, confidence: 0.75 })
      break
    }
  }

  for (const pattern of HESITATION_SIGNALS) {
    if (pattern.test(text)) {
      signals.push({ type: 'hesitation', weight: 0.5, confidence: 0.65 })
      break
    }
  }

  for (const pattern of OBJECTION_SIGNALS) {
    if (pattern.test(text)) {
      signals.push({ type: 'objection', weight: 0.5, confidence: 0.6 })
      break
    }
  }

  for (const pattern of CONFUSION_SIGNALS) {
    if (pattern.test(text)) {
      signals.push({ type: 'confusion', weight: 0.4, confidence: 0.65 })
      break
    }
  }

  if (text.length > 100) {
    signals.push({ type: 'engagement', weight: 0.5, confidence: 0.5 })
  }

  if (signals.length === 0) {
    signals.push({ type: 'interest', weight: 0.3, confidence: 0.3 })
  }

  return signals
}

export async function extractEvidenceFromCustomerMessage(
  params: EvidenceExtractionParams
): Promise<EvidenceItem[]> {
  const { customerId, conversationId, message, messageId } = params

  const signals = classifySignals(message)

  const evidenceItems: EvidenceItem[] = signals.map((signal) =>
    createEvidenceItem({
      message_id: messageId,
      conversation_id: conversationId,
      customer_id: customerId,
      timestamp: new Date().toISOString(),
      type: signal.type,
      weight: signal.weight,
      confidence: signal.confidence,
      metadata: { source: 'regex_extraction', raw_signal: message.slice(0, 100) },
    })
  )

  if (evidenceItems.length === 0) return []

  const supabase = createAdminClient()
  const memory = await getCustomerMemory(customerId)
  const existingEvidence = memory?.evidence ?? []
  const mergedEvidence = mergeEvidenceItems(existingEvidence, evidenceItems)

  const previousState = memory?.reasoning_state ?? createInitialState()
  const newState = computeCustomerState(previousState, evidenceItems)

  const updatedMemory: Record<string, unknown> = {
    ...(memory ?? {}),
    evidence: mergedEvidence.slice(-200),
    reasoning_state: newState,
  }

  await supabase
    .from('customers')
    .update({ memory: updatedMemory })
    .eq('id', customerId)

  return evidenceItems
}
