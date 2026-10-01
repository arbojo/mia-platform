/**
 * Channel operation mode as seen by the bridge.
 *
 * 'active'  — normal: the bridge may send to customers.
 * 'shadow'  — MIA thinks and learns, but the customer must see nothing.
 * 'paused'  — the channel is off: no sends at all.
 *
 * The bridge cannot infer this from MIA's response. `deliver:false` only proves
 * the *current turn* was silent; it says nothing about what the bridge should
 * do when MIA is unreachable and it wants to fall back to a local reply. Both
 * defensive paths (call-rejection text, audio fallback) therefore need to read
 * the mode themselves before writing to a customer.
 */
export type ChannelMode = 'active' | 'shadow' | 'paused'

/** Modes in which the bridge may write to a customer. */
export function allowsOutbound(mode: ChannelMode | null | undefined): boolean {
  // Unknown mode fails closed. A defensive auto-reply is never worth the risk of
  // breaking a shadow rehearsal: silence is always recoverable, a sent message
  // is not.
  return mode === 'active'
}

/**
 * Short-lived mode cache. The bridge consults the mode on defensive paths, not
 * per message, so a short TTL keeps the read off the hot path while still
 * picking up a mode change (active -> shadow) quickly enough to honour it.
 */
export class ChannelModeCache {
  private readonly entries = new Map<string, { mode: ChannelMode | null; expiresAt: number }>()

  constructor(
    private readonly ttlMs = 30_000,
    private readonly maxEntries = 500
  ) {}

  get(businessId: string): ChannelMode | null | undefined {
    const hit = this.entries.get(businessId)
    if (!hit) return undefined
    if (Date.now() >= hit.expiresAt) {
      this.entries.delete(businessId)
      return undefined
    }
    return hit.mode
  }

  set(businessId: string, mode: ChannelMode | null): void {
    if (this.entries.size >= this.maxEntries) this.evict()
    this.entries.set(businessId, { mode, expiresAt: Date.now() + this.ttlMs })
  }

  invalidate(businessId: string): void {
    this.entries.delete(businessId)
  }

  clear(): void {
    this.entries.clear()
  }

  private evict(): void {
    const now = Date.now()
    for (const [key, entry] of this.entries) {
      if (now >= entry.expiresAt) this.entries.delete(key)
    }
    if (this.entries.size < this.maxEntries) return
    const oldest = this.entries.keys().next()
    if (!oldest.done) this.entries.delete(oldest.value)
  }
}