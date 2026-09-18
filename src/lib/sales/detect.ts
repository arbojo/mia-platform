import { executeAI } from '@/lib/runtime/execute-ai'
import type { DetectedSaleEvent } from './events'

export interface SaleDetectionResult {
  outcome: 'pending' | 'interested' | 'not_interested' | 'sold' | 'cancelled' | null
  events: DetectedSaleEvent[]
  customerName?: string | null
  phone?: string | null
  city?: string | null
  address?: string | null
  products?: Array<{ name: string; amount?: number | null; quantity?: number | null }> | null
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
      "amount": 123.45 o null,
      "quantity": 1 o null
    }
  ],
  "customerName": "nombre del cliente si lo proporcionó o null",
  "phone": "teléfono del cliente si lo proporcionó o null (solo dígitos y +, sin espacios)",
  "city": "ciudad de entrega si la proporcionó o null",
  "address": "dirección de envío si la proporcionó o null",
  "products": [
    {"name": "nombre del producto", "amount": 123.45 o null, "quantity": 1 o null}
  ],
  "cancellationReason": "motivo de cancelación si aplica o null"
}

Reglas:
- outcome "sold" SOLO si el cliente confirmó explícitamente la compra (ej. "sí quiero", "lo llevo", "confirmo el pedido", o una afirmativa corta como "sí", "claro", "dale", "ok" inmediatamente después de que el vendedor solicitó confirmar el pedido).
- outcome "cancelled" SOLO si el cliente quiere cancelar una compra previa (ej. "quiero cancelar", "me arrepentí", "devuélveme"). Solo clasificar como cancelled si hay evidencia clara de una compra anterior en la conversación.
- outcome "not_interested" si el cliente rechazó o descartó la compra.
- outcome "interested" si el cliente mostró interés pero aún no confirmó.
- Emite SALE_WON si hay confirmación de compra; SALE_LOST si hay rechazo.
- RC5 (separación inequívoca de contextos): (a) VENTA NUEVA PENDIENTE DE CIERRE: si el vendedor acaba de solicitar confirmación explícita del pedido y el cliente responde con una afirmativa corta ("sí", "si", "claro", "dale", "va", "ok", "correcto", "exacto") o cualquier otra confirmación, SÍ emite SALE_WON. (b) PEDIDO CANCELADO: si el vendedor menciona o pregunta por un pedido que el cliente ya CANCELÓ (ej. "¿te confirmo tu pedido de X?" sobre un pedido cancelado) y el cliente responde con una afirmativa SIN mencionar un producto nuevo él mismo, NO emitas SALE_WON: esa confirmación es ambigua y el pedido cancelado ya no existe. (c) POST-VENTA CERRADA: si ya existe un SALE_WON previo en la conversación, NO reconstruyas ni reconfirmes el pedido anterior ante saludos o agradecimientos. (d) COMPRA NUEVA EXPLÍCITA: si el CLIENTE menciona explícitamente el producto que quiere comprar en su propia frase, procede con normalidad y emite los eventos correspondientes.
- amount solo cuando haya un precio acordado o mencionado.
- quantity: SOLO si el cliente indica una cantidad explícita (ej. "quiero 3", "dos unidades"). Entero >= 1. null si no hay cantidad explícita. Nunca inventes cantidades.
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

// === Gate contextual de afirmativas cortas (TASK-20260830-005512058) ===
// Una afirmativa corta SOLO puede disparar el cierre de venta cuando el
// contexto indica confirmación explícita pendiente. Nunca es un trigger global.

// Afirmativas aprobadas por Council — NO ampliar sin nueva aprobación.
const SHORT_AFFIRMATIVES = ['si', 'claro', 'dale', 'va', 'ok', 'correcto', 'exacto']

function normalizeForAffirmative(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Detecta si el mensaje del cliente es una afirmativa corta del set aprobado.
 * Match por token exacto (tras normalizar acentos, mayúsculas y puntuación),
 * nunca por substring, para evitar falsos positivos en palabras que las contienen.
 * Composiciones exclusivas de afirmativas aprobadas ("sí claro", "ok dale") también cuentan.
 */
export function hasShortAffirmative(message: string): boolean {
  const normalized = normalizeForAffirmative(message)
  if (!normalized) return false
  const tokens = normalized.split(' ')
  return tokens.length > 0 && tokens.every((t) => SHORT_AFFIRMATIVES.includes(t))
}

// Patrones deterministas de "solicitud de confirmación explícita" en mensajes
// del ASISTENTE. Solo se evalúan mensajes con role === 'assistant', por lo que
// un intento de prompt injection desde el mensaje del cliente no cuenta.
const CONFIRMATION_REQUEST_PATTERNS = [
  /confirm\w*\b[^\n]{0,60}\b(pedido|compra|orden)/i,
  /\b(pedido|compra|orden)\b[^\n]{0,60}\bconfirm/i,
  /\bte confirmo\b/i,
  /\b(quieres|deseas|gustaría|gustaria|procedo|procedemos|avanzo|avanzamos)[^\n]{0,40}\b(confirm|pedido|compra)/i,
  /\btodo correcto\b[^\n]{0,40}\b(confirm|pedido|compra)/i,
]

/**
 * Determina si el último mensaje del asistente ANTERIOR al último mensaje del
 * cliente solicitó confirmación explícita del pedido. Solo analiza turnos con
 * role === 'assistant': la afirmativa del cliente no puede simular este contexto.
 */
export function hasPendingConfirmationRequest(
  messages: Array<{ role: string; content: string }>
): boolean {
  const lastUserIdx = messages.reduce(
    (acc, m, i) => (m.role === 'user' ? i : acc),
    -1
  )
  if (lastUserIdx <= 0) return false
  for (let i = lastUserIdx - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.role !== 'assistant') continue
    return CONFIRMATION_REQUEST_PATTERNS.some((p) => p.test(msg.content))
  }
  return false
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

    // FASE 1 — Contrato Comercial: la cantidad solo es válida si es un entero >= 1.
    // Ausencia (undefined/null o no presente) => sin cantidad explícita => default
    // contractual 1 en el cierre. Cantidad explícita pero inválida (0, negativos,
    // decimales, strings, valores arbitrarios) => NO degrada a 1: aborta la
    // detección (mismo criterio para events[].quantity y products[].quantity).
    let hasInvalidQuantity = false
    const sanitizeQuantity = (value: unknown): number | undefined => {
      if (value === undefined || value === null) return undefined
      if (typeof value === 'number' && Number.isInteger(value) && value >= 1) return value
      hasInvalidQuantity = true
      return undefined
    }

    const events = (Array.isArray(parsed.events) ? parsed.events : [])
      .filter(
        (e): e is DetectedSaleEvent =>
          typeof e === 'object' &&
          e !== null &&
          typeof (e as DetectedSaleEvent).type === 'string' &&
          validTypes.has((e as DetectedSaleEvent).type)
      )
      .map((e) => ({ ...e, quantity: sanitizeQuantity(e.quantity) }))

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
      .filter((p): p is { name: string; amount?: number | null; quantity?: number | null } => {
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
        quantity: sanitizeQuantity(p.quantity),
      }))
      .slice(0, 20)

    if (hasInvalidQuantity) {
      console.error('Detection aborted: explicit quantity could not be sanitized (FASE 1)')
      return { outcome: null, events: [] }
    }

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
  // Primera persona / participio (desync con intent-classifier.ts — causa raíz
  // ORD-000012): "Cancelo la compra" no matcheaba → hasCancellationTrigger=false.
  // 'cancele' cubre también 'cancelé' (NFD: ambas normalizan a "cancele").
  'cancelo', 'cancele', 'cancelado', 'cancelada',
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

// === Clasificador de intención de compra NUEVA en conversaciones cerradas ===
// Se evalúa únicamente cuando la conversación tiene un cierre previo (ciclos de
// venta múltiples permitidos en un mismo hilo). Buckets:
//   delivery_issue → queja de entrega fallida: NO abre ciclo, emite señal a
//                    mia_signals (nunca silenciosa).
//   followup       → seguimiento/reconfirmación del pedido cerrado: bloqueo duro.
//   explicit       → recompra explícita (verbo de compra + contexto de producto,
//                    o reorden autocontenido): abre ciclo y permite nuevo cierre.
//   ambiguous      → puede ser recompra o reenvío/mención: corre detección LLM,
//                    pero el cierre exige evidencia de flujo nuevo (SALE_STARTED/
//                    PRODUCT_SELECTED) en el resultado de ESTE turno.
// Precedencia determinista: delivery_issue > followup > differ-ent-product > explicit > ambiguous.

const normalizeNfd = (text: string): string =>
  text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const DELIVERY_ISSUE_PATTERNS = [
  /no (me |)(ha |habia |había |han |)(llegado|llegó|llego|recibido|recibi|recibí)/,
  /sigo sin (recibir|recibir el|recibirlo)/,
  /(pedido|paquete|envio|envío).{0,25}no (me |)(ha |)(llegado|llegó|llego)/,
  /nunca (me |)(llegó|llego|recibí|recibi)/,
  /todav[ií]a no (me |)(llega|llegó|llego|llegado)/,
  /ya (pague|pagué|pago).{0,30}(no me llega|no me llego|no he recibido)/,
  /no recib[ií] nada/,
]

const FOLLOWUP_PATTERNS = [
  /(ya va|va en camino|viene en camino|en camino)/,
  /cu[áa]ndo (llega|llegará|llegara|va a llegar|me llega|me va a llegar|me llego)/,
  /d[oó]nde est[áa] mi (pedido|envio|envío|paquete)/,
  /y mi (pedido|envio|envío)/,
  /c[oó]mo va (mi |el |)(pedido|envio|envío|reparto)/,
  /(status|estatus|seguimiento).{0,20}(pedido|envio|envío|entrega|reparto)/,
  /me lo cambian|me lo cambio|me (lo )?cambias|(que )?me lo cambien|quiero (cambiarlo|cambiar|devolverlo)/,
  /^((muchas )?gracias|perfecto|excelente|listo)/,
  /reenvi[ae]rme el pedido|me reenv[ií]as el pedido/,
]

// Reorden autocontenido: se refiere al pedido anterior por su naturaleza ("repetir",
// "el mismo de antes") sin necesitar contexto de producto del turno para desambiguar.
const EXPLICIT_REORDER_PATTERNS = [
  /repetir (el |)pedido|repite(me | |)(el |)(primer |)pedido|repet[ií] (el |)(primer |)pedido/,
  /el (mismo|mismo producto|mismo modelo) (de |que )(la vez pasada|antes|anterior)|otra vez el pedido|de nuevo el pedido|otro igual al (de |de la vez pasada|anterior)/,
  /quiero reponer|reponer el producto|necesito reponer|reponer (este|esto|el) /,
]

// Compra anafórica: pronombres/elipsis sobre el producto activo (requiere productId).
const ANAPHORIC_PURCHASE_PATTERNS = [
  /lo quiero|lo llevo|lo pido|d[áa]melo|d[áa]me otro|quiero otro|quiero m[áa]s|necesito otro|me llevo otro|otro igual|m[áa]ndame|ord[ée]name|rec[áa]rgame/,
  /(quiero|necesito|me gustar[ií]a|voy a comprar|quiero comprar|me llevo|comprarlo|comprarla) (otro|uno|m[áa]s|de nuevo|el|la|lo)/,
  // solo el verbo de compra + contexto de producto del turno (productId) basta
  /\b(quiero|necesito|me gustar[ií]a|voy a comprar|quiero comprar)\b/,
]

// Producto DISTINTO al activo: posible compra nueva pero de otro SKU — el scope
// activo (productId) NO corresponde a lo pedido → se degrada a ambiguous.
const DIFFERENT_PRODUCT_PATTERNS = [
  /otro producto|el otro|otro modelo|otra presentaci[oó]n|otra presentacion|otro color|otra talla|otra marca|diferente|otro de la|otra cosa|algo distinto/,
]

const AMBIGUOUS_PATTERNS = [
  /me (lo |)mandas de nuevo|me (lo |)env[ií]as de nuevo/,
  /otra vez (lo mismo|la misma|el mismo)/,
  /lo mismo (de |que )la vez pasada|lo mismo de antes/,
  /el (que |)me (vendiste|dijiste|mostraste) antes|ese que (vi |mostraste )antes/,
  /igual al (que |)anterior|igual al (de |de la vez pasada)/,
  /ese mismo|quiero el mismo/,
  /uno igual|el igual/,
]

export function isExplicitNewPurchaseIntent(
  message: string,
  productId: string | null
): 'explicit' | 'followup' | 'delivery_issue' | 'ambiguous' {
  const normalized = normalizeNfd(message)

  if (DELIVERY_ISSUE_PATTERNS.some((p) => p.test(normalized))) return 'delivery_issue'
  if (FOLLOWUP_PATTERNS.some((p) => p.test(normalized))) return 'followup'
  if (DIFFERENT_PRODUCT_PATTERNS.some((p) => p.test(normalized))) return 'ambiguous'
  if (EXPLICIT_REORDER_PATTERNS.some((p) => p.test(normalized))) return 'explicit'
  // Frases ambiguas conocidas (p.ej. "quiero el mismo", "me lo mandas de nuevo") se
  // evalúan ANTES de la compra anafórica: no son evidencia suficiente por sí solas.
  if (AMBIGUOUS_PATTERNS.some((p) => p.test(normalized))) return 'ambiguous'
  if (productId && ANAPHORIC_PURCHASE_PATTERNS.some((p) => p.test(normalized))) {
    return 'explicit'
  }
  return 'ambiguous'
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
