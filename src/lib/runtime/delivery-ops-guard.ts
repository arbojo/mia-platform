export type DeliveryOpsKind = 'reschedule' | 'driver_on_the_way' | 'customer_waiting' | null

export interface DeliveryOpsResult {
  kind: DeliveryOpsKind
}

const RESCHEDULE_PATTERNS = [
  /\breagend\w*\b/,
  /\breprogram\w*\b/,
  /\bcambiar\b.*\b(entrega|env[ií]o|pedido|d[ií]a|hora)\b/,
  /\b(entrega|env[ií]o|pedido)\b.*\bcambiar\b/,
  /\bcambio\b.*\b(entrega|env[ií]o|pedido)\b/,
]

const DRIVER_PATTERNS = [
  /\brepartidor\w*\b/,
  /\bva\sen\scamino\b/,
  /\bviene\sen\scamino\b/,
  /\bya\s?v[aá]?\b.*\brepartidor\b/,
  /\brepartidor\b.*\bya\b/,
]

const WAITING_PATTERNS = [
  /\bya\sllegu[ée]?\b/,
  /\bya\slleg[oó]?\b/,
  /\bya\stestoy\b/,
  /\bestoy\sen\scasa\b/,
  /\bestoy\saqu[ií]\b/,
  /\bestoy\saquí\b/,
  /\ben\sl[ao]s?\s?puertas?\b/,
  /\ben\spuerta\b/,
  /\bafuera\b/,
  /\bcu[aá]nto\sfalta\b/,
  /\bcu[aá]ndo\sllega\b/,
]

export function detectDeliveryOps(text: string): DeliveryOpsResult {
  if (!text) return { kind: null }
  const normalized = text.toLowerCase()

  // Reschedule is highest priority for explicit operational requests
  for (const p of RESCHEDULE_PATTERNS) {
    if (p.test(normalized)) {
      return { kind: 'reschedule' }
    }
  }

  // Driver mentions / en route
  for (const p of DRIVER_PATTERNS) {
    if (p.test(normalized)) {
      return { kind: 'driver_on_the_way' }
    }
  }

  // Customer waiting / arrival signals
  for (const p of WAITING_PATTERNS) {
    if (p.test(normalized)) {
      return { kind: 'customer_waiting' }
    }
  }

  return { kind: null }
}

export function buildDeliveryOpsResponse(kind: DeliveryOpsKind): string {
  switch (kind) {
    case 'reschedule':
      return 'Con gusto. Para mover tu entrega, paso tu mensaje al equipo de reparto para que te confirmen el nuevo día/horario por este medio.'
    case 'driver_on_the_way':
      return '¡Gracias por avisar! ¡Gracias por avisar! Paso este mensaje al equipo de reparto.'
    case 'customer_waiting':
      return 'Perfecto. Ya aviso al equipo de reparto que estás esperando. Te confirman por aquí.'
    default:
      return 'Perfecto. Paso tu mensaje al equipo de reparto para que te ayuden.'
  }
}







