import { executeAI } from '@/lib/runtime/execute-ai'
import type { DetectedSaleEvent } from './events'

export interface SaleDetectionResult {
  outcome: 'pending' | 'interested' | 'not_interested' | 'sold' | 'cancelled' | null
  events: DetectedSaleEvent[]
  customerName?: string | null
  phone?: string | null
  city?: string | null
  address?: string | null
  products?: Array<{ name: string; amount?: number | null }> | null
  cancellationReason?: string | null
}

const DETECTION_SYSTEM_PROMPT = `Eres un analizador de conversaciones de venta. Analiza el diálogo entre un vendedor y un cliente y determina el estado de la venta.

Devuelve SOLO un JSON con esta forma:
{
  "outcome": "pending" | "interested" | "not_interested" | "sold" | "cancelled",
  "events": [
    {
      "type": "SALE_STARTED" | "PRODUCT_SELECTED" | "OBJECTION_DETECTED" | "OBJECTION_RESOLVED" | "UPSELL_ACCEPTED" | "CROSSSELL_ACCEPTED" | "FOLLOWUP_REQUIRED" | "SALE_WON" | "SALE_LOST" | "CUSTOMER_HESITATION" | "PRICE_ACCEPTED" | "PRICE_REJECTED",
      "productName": "nombre del producto o null",
      "amount": 123.45 o null
    }
  ],
  "customerName": "nombre del cliente si lo proporcionó o null",
  "phone": "teléfono del cliente si lo proporcionó o null (solo dígitos y +, sin espacios)",
  "city": "ciudad de entrega si la proporcionó o null",
  "address": "dirección de envío si la proporcionó o null",
  "products": [
    {"name": "nombre del producto", "amount": 123.45 o null}
  ],
  "cancellationReason": "motivo de cancelación si aplica o null"
}

Reglas:
- outcome "sold" SOLO si el cliente confirmó explícitamente la compra (ej. "sí quiero", "lo llevo", "confirmo el pedido").
- outcome "cancelled" SOLO si el cliente quiere cancelar una compra previa (ej. "quiero cancelar", "me arrepentí", "devuélveme"). Solo clasificar como cancelled si hay evidencia clara de una compra anterior en la conversación.
- outcome "not_interested" si el cliente rechazó o descartó la compra.
- outcome "interested" si el cliente mostró interés pero aún no confirmó.
- Emite SALE_WON si hay confirmación de compra; SALE_LOST si hay rechazo.
- amount solo cuando haya un precio acordado o mencionado.
- No inventes eventos. Solo emite los que tengan evidencia directa en el diálogo.
- Si no hay suficiente información para clasificar, devuelve outcome "pending" y events [].`

export function hasSalesTrigger(lastUserMessage: string): boolean {
  // Solo disparadores de intención de compra REAL.
  // Palabras de información/consulta (precio, cuánto, cuesta, costo) se excluyen
  // para que una simple pregunta de precios no active el pipeline de ventas.
  const triggers = [
    // Compra explícita
    'compr', 'quiero', 'llevo', 'confirmo', 'me llevo', 'lo llevo', 'pedido',
    // Pago (cuando el cliente ya está en proceso de compra)
    'pago', 'pagar', 'tarjeta', 'transferencia', 'depósito', 'deposito', 'efectivo',
    // Logística de entrega
    'dirección', 'direccion', 'envío', 'envio', 'entrega',
    // Cierre / aceptación
    'listo', 'dalo', 'dámelo', 'damelo', 'lo quiero',
    'si quiero', 'sí quiero', 'acepto', 'acepto el pedido', 'confirmar', 'me interesa',
    // Rechazo / objeción
    'no me interesa', 'no gracias', 'mejor no', 'rechazo', 'caro', 'cara', 'no me alcanza',
    'necesito pensarlo', 'lo pienso', 'lo voy a pensar',
    // Datos personales del cliente (captura de pedido)
    'teléfono', 'telefono', 'celular', 'mi número', 'mi numero', 'te paso mi',
    'me llamo', 'vivo en', 'mi dirección', 'mi direccion', 'domicilio',
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

  const result = await executeAI({
    mode: 'complete',
    taskType: 'detection',
    businessId,
    assistantId,
    requestType: 'live_customer',
    system: DETECTION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: transcript }],
    maxTokens: 300,
    temperature: 0,
  })

  const raw = result.content
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { outcome: null, events: [] }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<SaleDetectionResult>
    const validOutcomes = ['pending', 'interested', 'not_interested', 'sold', 'cancelled'] as const
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

    const sanitizePhone = (value: unknown): string | undefined => {
      if (typeof value !== 'string') return undefined
      const cleaned = value.replace(/[^\d+]/g, '').trim()
      return cleaned.length >= 6 ? cleaned : undefined
    }

    const sanitizeShortText = (value: unknown): string | undefined => {
      if (typeof value !== 'string') return undefined
      const cleaned = value.trim()
      return cleaned.length > 0 && cleaned.length <= 200 ? cleaned : undefined
    }

    const rawProducts = Array.isArray(parsed.products) ? parsed.products : []
    const products = rawProducts
      .filter((p): p is { name: string; amount?: number | null } => {
        if (typeof p !== 'object' || p === null) return false
        const name = (p as { name?: unknown }).name
        return typeof name === 'string' && name.trim().length > 0
      })
      .map((p) => ({
        name: (p.name as string).trim().slice(0, 200),
        amount:
          typeof p.amount === 'number' && Number.isFinite(p.amount) && p.amount >= 0
            ? p.amount
            : undefined,
      }))
      .slice(0, 20)

    return {
      outcome,
      events,
      customerName: typeof parsed.customerName === 'string' ? parsed.customerName : undefined,
      phone: sanitizePhone(parsed.phone),
      city: sanitizeShortText(parsed.city),
      address: typeof parsed.address === 'string' ? parsed.address : undefined,
      products: products.length > 0 ? products : undefined,
    }
  } catch {
    return { outcome: null, events: [] }
  }
}

const CANCELLATION_KEYWORDS = [
  'cancelar', 'cancela', 'anular', 'anula', 'devolver', 'devuelvo',
  'no quiero', 'ya no quiero', 'me arrepentí', 'me arrepenti',
  'dame de baja', 'baja', 'reembolso', 'revertir', 'deshacer',
  'cambié de opinión', 'cambie de opinion', 'no lo quiero más',
  'quiero cancelar', 'necesito cancelar', 'puedo cancelar',
  'olvídalo', 'olvidalo', 'no sigas', 'no gracias',
]

const DISCOUNT_ACCEPTANCE_KEYWORDS = [
  'quiero el descuento', 'si quiero el descuento', 'sí quiero el descuento',
  'dame el descuento', 'si dame el descuento', 'sí dame el descuento',
  'aplícame el descuento', 'aplicame el descuento',
  'dale descuento', 'dale con descuento',
  'si, quiero el descuento', 'si, dame el descuento',
  'sí, quiero el descuento', 'sí, dame el descuento',
]

export function hasDiscountAcceptanceTrigger(lastUserMessage: string): boolean {
  const normalized = lastUserMessage
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return DISCOUNT_ACCEPTANCE_KEYWORDS.some((kw) => {
    const kn = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return normalized.includes(kn)
  })
}

export function hasCancellationTrigger(lastUserMessage: string): boolean {
  const normalized = lastUserMessage
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  return CANCELLATION_KEYWORDS.some((kw) => {
    const kn = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return normalized.includes(kn)
  })
}

const CANCELLATION_SYSTEM_PROMPT = `Eres un analizador de intenciones de cancelación de compra.
Analiza la conversación y determina si el cliente confirma que quiere cancelar un pedido reciente.

Devuelve SOLO un JSON con esta forma:
{
  "confirmed": true | false,
  "reason": "motivo si lo menciona o null"
}

Reglas:
- confirmed=true SOLO si el cliente CONFIRMA explícitamente que quiere cancelar (ej. "sí, quiero cancelar", "cancela, ya no lo quiero").
- confirmed=false si el cliente solo PREGUNTA si puede cancelar, o si el contexto no es claro.
- NO confundas "no quiero" genérico (de otro producto o tema) con cancelación de una compra previa.
- El cliente debe haber hecho una compra anterior en la misma conversación para que sea cancellation.`

export async function detectCancellation(params: {
  businessId: string
  assistantId: string
  messages: Array<{ role: string; content: string }>
}): Promise<{ confirmed: boolean; reason: string | null }> {
  const { businessId, assistantId, messages } = params

  const transcript = messages
    .slice(-8)
    .map((m) => `${m.role === 'user' ? 'Cliente' : 'Vendedor'}: ${m.content}`)
    .join('\n')

  try {
    const result = await executeAI({
      mode: 'complete',
      taskType: 'detection',
      businessId,
      assistantId,
      requestType: 'live_customer',
      system: CANCELLATION_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: transcript }],
      maxTokens: 150,
      temperature: 0,
    })

    const raw = result.content
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return { confirmed: false, reason: null }

    const parsed = JSON.parse(jsonMatch[0]) as { confirmed?: boolean; reason?: string | null }
    return {
      confirmed: typeof parsed.confirmed === 'boolean' ? parsed.confirmed : false,
      reason: typeof parsed.reason === 'string' ? parsed.reason : null,
    }
  } catch {
    return { confirmed: false, reason: null }
  }
}
