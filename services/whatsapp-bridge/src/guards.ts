export interface CooldownStoreOptions {
  maxEntries: number
  windowMs: number
}

export interface CooldownStore {
  check(jid: string): boolean
  size(): number
}

/**
 * Synchronous in-memory anti-spam guard. Each jid may pass `check()` at most
 * once per `windowMs`. Entries carry an expiry timestamp; expired entries are
 * pruned lazily on access and, when the store exceeds `maxEntries`, a purge
 * removes expired entries first and then the oldest by insertion order. Memory
 * is bounded by `maxEntries` regardless of how many distinct jids ever call.
 * No timers are used, so there is nothing to leak or clean up on disconnect.
 */
export function createCooldownStore(options: CooldownStoreOptions): CooldownStore {
  const { maxEntries, windowMs } = options
  const entries = new Map<string, number>()

  function purge(): void {
    if (entries.size <= maxEntries) return

    const now = Date.now()
    for (const [key, ts] of entries) {
      if (now - ts >= windowMs) {
        entries.delete(key)
        if (entries.size <= maxEntries) return
      }
    }

    for (const key of entries.keys()) {
      entries.delete(key)
      if (entries.size <= maxEntries) return
    }
  }

  return {
    check(jid: string): boolean {
      const now = Date.now()
      const last = entries.get(jid)

      if (last !== undefined) {
        if (now - last < windowMs) return false
        entries.delete(jid)
      }

      entries.set(jid, now)
      purge()
      return true
    },

    size(): number {
      return entries.size
    },
  }
}
