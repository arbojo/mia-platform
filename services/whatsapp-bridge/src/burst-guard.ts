export function normalizeBurstText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\r\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface BurstGuardOptions {
  windowMs?: number
  maxEntries?: number
}

export class BurstGuard {
  private readonly recent = new Map<string, { text: string; at: number }>()
  private readonly windowMs: number
  private readonly maxEntries: number

  constructor(options: BurstGuardOptions = {}) {
    this.windowMs = options.windowMs ?? 2000
    this.maxEntries = options.maxEntries ?? 2048
  }

  private key(businessId: string, remoteJid: string): string {
    return `${businessId}:${remoteJid}`
  }

  private prune(now: number): void {
    for (const [k, v] of this.recent) {
      if (now - v.at > this.windowMs) {
        this.recent.delete(k)
      }
    }
  }

  /**
   * true si el mismo texto del mismo remitente se procesó dentro de la ventana.
   */
  isRepeat(businessId: string, remoteJid: string, text: string, now: number = Date.now()): boolean {
    this.prune(now)
    const norm = normalizeBurstText(text)
    if (!norm) return false
    const prev = this.recent.get(this.key(businessId, remoteJid))
    return Boolean(prev && prev.text === norm && now - prev.at <= this.windowMs)
  }

  /**
   * Marca un mensaje como procesado (llamar SOLO tras un manejo exitoso).
   */
  record(businessId: string, remoteJid: string, text: string, now: number = Date.now()): void {
    this.prune(now)
    const norm = normalizeBurstText(text)
    if (!norm) return
    this.recent.set(this.key(businessId, remoteJid), { text: norm, at: now })
    if (this.recent.size > this.maxEntries) {
      let oldestKey: string | null = null
      let oldestAt = Number.POSITIVE_INFINITY
      for (const [k, v] of this.recent) {
        if (v.at < oldestAt) {
          oldestAt = v.at
          oldestKey = k
        }
      }
      if (oldestKey) {
        this.recent.delete(oldestKey)
      }
    }
  }

  clear(businessId: string): void {
    const prefix = `${businessId}:`
    for (const k of this.recent.keys()) {
      if (k.startsWith(prefix)) {
        this.recent.delete(k)
      }
    }
  }
}
