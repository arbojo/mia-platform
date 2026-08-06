import { normalizeText } from './media'
import type { InteractiveComponent, MessagePayload } from '@/lib/channels/types'
import type { Database } from '@/lib/types'

type Product = Database['public']['Tables']['products']['Row']

export type IntentTag =
  | 'catalog'
  | 'price'
  | 'shipping'
  | 'payment'
  | 'contact'
  | 'greeting'

const INTENT_KEYWORDS: Record<IntentTag, string[]> = {  catalog: [
    'producto',
    'productos',
    'catalogo',
    'menu',
    'que tienen',
    'que venden',
    'que ofrecen',
    'opciones',
  ],
  price: [
    'precio',
    'precios',
    'cuanto cuesta',
    'cuanto vale',
    'cuanto es',
    'costo',
    'tarifa',
    'valor',
  ],
  shipping: [
    'envio',
    'envios',
    'despacho',
    'entrega',
    'domicilio',
    'zona',
    'reparto',
    'donde lo llevan',
  ],
  payment: [
    'pago',
    'pagos',
    'transferencia',
    'tarjeta',
    'efectivo',
    'como pago',
    'formas de pago',
    'metodos de pago',
  ],
  contact: [
    'persona',
    'humano',
    'asesor',
    'hablar con alguien',
    'telefono',
    'llamar',
    'whatsapp de contacto',
    'contacto',
  ],
  greeting: ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'que tal', 'que hubo'],
}

const INTENT_PAYLOAD_PREFIX = 'intent:'

export function intentFromPayload(payload: MessagePayload): IntentTag | null {
  if (payload.type !== 'quick_reply') return null
  if (!payload.id.startsWith(INTENT_PAYLOAD_PREFIX)) return null
  const tag = payload.id.slice(INTENT_PAYLOAD_PREFIX.length) as IntentTag
  return tag in INTENT_KEYWORDS ? tag : null
}

export function detectIntent(message: string, payload?: MessagePayload): IntentTag | null {
  const fromPayload = payload ? intentFromPayload(payload) : null
  if (fromPayload) return fromPayload

  const normalized = normalizeText(message)
  for (const [tag, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (keywords.some((keyword) => normalized.includes(normalizeText(keyword)))) {
      return tag as IntentTag
    }
  }
  return null
}

export const SALES_INTENTS: IntentTag[] = ['price', 'shipping', 'payment']

export function isSalesIntent(intent: IntentTag | null): boolean {
  return intent !== null && SALES_INTENTS.includes(intent)
}

export function intentButtonId(tag: IntentTag): string {
  return `${INTENT_PAYLOAD_PREFIX}${tag}`
}

export function buildInteractiveForIntent(
  intent: IntentTag,
  products: Product[],
  text: string
): InteractiveComponent | null {
  if (intent === 'catalog' || intent === 'price') {
    const active = products.filter((p) => p.is_active)
    if (active.length === 0) return null

    return {
      type: 'list',
      text,
      buttonText: 'Ver productos',
      sections: [
        {
          title: 'Productos',
          rows: active.slice(0, 10).map((p) => ({
            id: p.id,
            title: p.name,
            description: p.price != null ? `$${p.price}` : undefined,
          })),
        },
      ],
    }
  }

  const buttons: Record<IntentTag, Array<{ id: string; title: string }> | null> = {
    greeting: [
      { id: intentButtonId('catalog'), title: 'Ver catálogo' },
      { id: intentButtonId('shipping'), title: 'Envíos' },
      { id: intentButtonId('contact'), title: 'Hablar con alguien' },
    ],
    shipping: [
      { id: intentButtonId('shipping'), title: 'Zonas de envío' },
      { id: intentButtonId('payment'), title: 'Formas de pago' },
      { id: intentButtonId('contact'), title: 'Hablar con alguien' },
    ],
    payment: [
      { id: intentButtonId('payment'), title: 'Medios de pago' },
      { id: intentButtonId('shipping'), title: 'Envíos' },
      { id: intentButtonId('contact'), title: 'Hablar con alguien' },
    ],
    contact: [
      { id: intentButtonId('catalog'), title: 'Ver catálogo' },
      { id: intentButtonId('contact'), title: 'Sí, quiero que me contacten' },
      { id: intentButtonId('shipping'), title: 'Envíos' },
    ],
    catalog: null,
    price: null,
  }

  const options = buttons[intent]
  if (!options) return null

  return {
    type: 'quick_reply',
    text,
    buttons: options.slice(0, 3),
  }
}
