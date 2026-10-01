/**
 * Registro de mensajes enviados por el bridge.
 *
 * Por qué existe: Baileys emite `messages.upsert` para TODO lo que sale del
 * propio número (`key.fromMe === true`), incluyendo los envíos del propio
 * bridge. Eso significa que `fromMe` no distingue "la vendedora escribió" de
 * "MIA respondió": son el mismo número.
 *
 * Sin este registro, aprender de la vendedora exigiría dejar de filtrar
 * `fromMe`, y entonces MIA leería su propia respuesta como mensaje del cliente
 * y volvería a contestar — un bucle infinito de mensajes.
 *
 * `sendMessage` de Baileys devuelve el `WAMessage` enviado, cuyo `key.id` es el
 * mismo id que llega luego en el `upsert`. Guardando ese id podemos separar los
 * dos casos de forma exacta en vez de heurística.
 *
 * TTL generoso (2h) porque los upsert de un envío pueden llegar con retraso
 * tras una reconexión, y un id no registrado a tiempo se perdería (o, peor,
 * se interpretaría como mensaje humano).
 */

export const SENT_REGISTRY_TTL_MS = 2 * 60 * 60 * 1000

/**
 * Extrae el `key.id` del valor devuelto por `socket.sendMessage`.
 *
 * Se mantiene tolerante a propósito: según la versión de Baileys el retorno
 * puede ser el WAMessage directo o un objeto envuelto. Antes esto se descartaba
 * por completo, así que cualquier forma no reconocida devuelve null y el
 * mensaje se trata como no-enviado (conservador: preferimos perder un registro
 * antes que marcar un mensaje humano como si fuera de MIA).
 */
export function extractSentMessageId(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null
  const candidate = result as { key?: { id?: unknown }; message?: { key?: { id?: unknown } } }
  const direct = candidate.key?.id
  if (typeof direct === 'string' && direct.length > 0) return direct
  const nested = candidate.message?.key?.id
  if (typeof nested === 'string' && nested.length > 0) return nested
  return null
}

/**
 * Set de ids enviados con TTL, por business. Replica el patrón ya usado para
 * `processedMessageIds` en session-manager.ts para no inventar un segundo
 * estilo de caché en el mismo archivo.
 */
export class SentMessageRegistry {
  private readonly ids = new Map<string, Map<string, number>>()
  private readonly ttlMs: number

  constructor(ttlMs: number = SENT_REGISTRY_TTL_MS) {
    this.ttlMs = ttlMs
  }

  /**
   * Registra un id (o varios, para envíos que generan más de un upsert como
   * los botones interactivos). Ids no-string se ignoran.
   */
  add(businessId: string, ids: Array<string | null | undefined>): void {
    let store = this.ids.get(businessId)
    if (!store) {
      store = new Map<string, number>()
      this.ids.set(businessId, store)
    }
    const now = Date.now()
    for (const id of ids) {
      if (typeof id === 'string' && id.length > 0) store.set(id, now)
    }
    this.cleanup(businessId)
  }

  /** true si este id fue enviado por el bridge (y aún no expiró). */
  has(businessId: string, id: string): boolean {
    if (!id) return false
    const store = this.ids.get(businessId)
    if (!store) return false
    const ts = store.get(id)
    if (ts === undefined) return false
    if (Date.now() - ts > this.ttlMs) {
      store.delete(id)
      return false
    }
    return true
  }

  private cleanup(businessId: string): void {
    const store = this.ids.get(businessId)
    if (!store) return
    const now = Date.now()
    for (const [id, ts] of store) {
      if (now - ts > this.ttlMs) store.delete(id)
    }
  }

  /** Limpia al desconectar/logout para no arrastrar ids entre sesiones. */
  clear(businessId: string): void {
    this.ids.delete(businessId)
  }
}