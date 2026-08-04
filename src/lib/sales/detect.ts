import { getOpenAIClient, MODEL } from '@/lib/ai/client'
import { trackAiUsage } from '@/lib/ai/cost'
import type { DetectedSaleEvent } from './events'

export interface SaleDetectionResult {
  outcome: 'pending' | 'interested' | 'not_interested' | 'sold' | null
  events: DetectedSaleEvent[]
  customerName?: string | null
  address?: string | null
}

const DETECTION_SYSTEM_PROMPT = `Eres un analizador de conversaciones de venta. Analiza el diálogo entre un vendedor y un cliente y determina el estado de la venta.

Devuelve SOLO un JSON con esta forma:
{
  "outcome": "pending" | "interested" | "not_interested" | "sold",
  "events": [
    {
      "type": "SALE_STARTED" | "PRODUCT_SELECTED" | "OBJECTION_DETECTED" | "OBJECTION_RESOLVED" | "UPSELL_ACCEPTED" | "CROSSSELL_ACCEPTED" | "FOLLOWUP_REQUIRED" | "SALE_WON" | "SALE_LOST" | "CUSTOMER_HESITATION" | "PRICE_ACCEPTED" | "PRICE_REJECTED",
      "productName": "nombre del producto o null",
      "amount": 123.45 o null
    }
  ],
  "customerName": "nombre del cliente si lo proporcionó o null",
  "address": "dirección de envío si la proporcionó o null"
}

Reglas:
- outcome "sold" SOLO si el cliente confirmó explícitamente la compra (ej. "sí quiero", "lo llevo", "confirmo el pedido").
- outcome "not_interested" si el cliente rechazó o descartó la compra.
- outcome "interested" si el cliente mostró interés pero aún no confirmó.
- Emite SALE_WON si hay confirmación de compra; SALE_LOST si hay rechazo.
- amount solo cuando haya un precio acordado o mencionado.
- No inventes eventos. Solo emite los que tengan evidencia directa en el diálogo.
- Si no hay suficiente información para clasificar, devuelve outcome "pending" y events [].`

export function hasSalesTrigger(lastUserMessage: string): boolean {
  const triggers = [
    'compr', 'quiero', 'llevo', 'confirmo', 'me llevo', 'lo llevo', 'pedido',
    'cuánto', 'cuanto', 'precio', 'cuesta', 'costo', 'pago', 'pagar', 'tarjeta',
    'transferencia', 'depósito', 'deposito', 'efectivo', 'dirección', 'direccion',
    'envío', 'envio', 'entrega', 'listo', 'dalo', 'dámelo', 'damelo', 'lo quiero',
    'si quiero', 'sí quiero', 'acepto', 'acepto el pedido', 'confirmar', 'me interesa',
    'no me interesa', 'no gracias', 'mejor no', 'rechazo', 'caro', 'cara', 'no me alcanza',
    'necesito pensarlo', 'lo pienso', 'lo voy a pensar',
  ]
  const normalized = lastUserMessage.toLowerCase()
  return triggers.some((t) => normalized.includes(t))
}

export async function detectSaleOutcome(params: {
  businessId: string
  assistantId: string
  messages: Array<{ role: string; content: string }>
}): Promise<SaleDetectionResult> {
  const { businessId, assistantId, messages } = params

  const transcript = messages
    .slice(-12)
    .map((m) => `${m.role === 'user' ? 'Cliente' : 'Vendedor'}: ${m.content}`)
    .join('\n')

  const completion = await getOpenAIClient().chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: DETECTION_SYSTEM_PROMPT },
      { role: 'user', content: transcript },
    ],
    max_tokens: 300,
    temperature: 0,
  })

  const promptTokens = completion.usage?.prompt_tokens ?? 0
  const completionTokens = completion.usage?.completion_tokens ?? 0

  await trackAiUsage({
    business_id: businessId,
    assistant_id: assistantId,
    promptTokens,
    completionTokens,
    request_type: 'live_customer',
  })

  const raw = completion.choices[0]?.message?.content ?? ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { outcome: null, events: [] }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<SaleDetectionResult>
    const validOutcomes = ['pending', 'interested', 'not_interested', 'sold'] as const
    const outcome = validOutcomes.includes(parsed.outcome as (typeof validOutcomes)[number])
      ? (parsed.outcome as SaleDetectionResult['outcome'])
      : null

    const validTypes = new Set([
      'SALE_STARTED',
      'PRODUCT_SELECTED',
      'OBJECTION_DETECTED',
      'OBJECTION_RESOLVED',
      'UPSELL_ACCEPTED',
      'CROSSSELL_ACCEPTED',
      'FOLLOWUP_REQUIRED',
      'SALE_WON',
      'SALE_LOST',
      'CUSTOMER_HESITATION',
      'PRICE_ACCEPTED',
      'PRICE_REJECTED',
    ])

    const events = (Array.isArray(parsed.events) ? parsed.events : []).filter(
      (e): e is DetectedSaleEvent =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as DetectedSaleEvent).type === 'string' &&
        validTypes.has((e as DetectedSaleEvent).type)
    )

    return {
      outcome,
      events,
      customerName: typeof parsed.customerName === 'string' ? parsed.customerName : undefined,
      address: typeof parsed.address === 'string' ? parsed.address : undefined,
    }
  } catch {
    return { outcome: null, events: [] }
  }
}
