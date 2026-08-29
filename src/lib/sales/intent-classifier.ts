export type UserIntent = 'explicit_purchase' | 'casual' | 'order_reference'

const PURCHASE_SIGNALS = [
  'quiero comprar', 'comprar', 'compro',
  'quiero llevar', 'me llevo', 'lo llevo',
  'quiero pedir', 'hacer pedido', 'quisiera comprar',
  'me gustaria comprar', 'necesito comprar',
  'dame uno', 'dame una', 'dame 1',
  'ponme uno', 'ponme una', 'ponme 1',
  'quiero uno', 'quiero una', 'quiero 1',
  'yo quiero', 'lo quiero',
  'me interesa comprar',
  'confirmar pedido', 'confirmo el pedido', 'quiero confirmar',
]

const CANCELLATION_AND_NEGATION = [
  'cancelar', 'cancela', 'cancelo', 'cancelado', 'cancelada',
  'no quiero', 'ya no quiero', 'no lo quiero', 'no me interesa',
  'mejor no', 'olvídalo', 'olvidalo', 'no sigas', 'no gracias',
  'devolver', 'devuelvo', 'reembolso', 'revertir', 'deshacer',
  'me arrepenti', 'cambie de opinion',
  'dame de baja', 'baja',
]

const ORDER_REFERENCE_SIGNALS = [
  'mi pedido', 'el pedido', 'ese pedido', 'mi orden', 'la orden',
  'que paso con', 'que fue de',
  'mi compra', 'la compra',
  'lo que pedi', 'ese producto que pedi',
  'donde esta mi pedido', 'cuando llega mi pedido',
  'status del pedido', 'estado del pedido',
]

const CASUAL_SIGNALS = [
  'hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches',
  'hey', 'que tal', 'como estas',
  'gracias', 'ok', 'dale', 'perfecto', 'bien',
  'adios', 'chao', 'hasta luego', 'nos vemos',
  'help', 'ayuda', 'opciones', 'menu',
]

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function containsAny(normalized: string, keywords: string[]): boolean {
  return keywords.some((kw) => normalized.includes(kw))
}

export function classifyUserIntent(message: string): UserIntent {
  const n = normalize(message)

  if (containsAny(n, CANCELLATION_AND_NEGATION)) {
    return 'casual'
  }

  if (containsAny(n, PURCHASE_SIGNALS)) {
    return 'explicit_purchase'
  }

  if (containsAny(n, ORDER_REFERENCE_SIGNALS)) {
    return 'order_reference'
  }

  if (containsAny(n, CASUAL_SIGNALS)) {
    return 'casual'
  }

  return 'casual'
}
