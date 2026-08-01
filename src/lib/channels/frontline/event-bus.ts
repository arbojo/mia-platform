import { randomUUID } from 'node:crypto'
import type { FrontlineEvent, FrontlineEventSubscriber } from './types'

/**
 * In-process event bus. Producers (the transport router today; probes, feed
 * collectors and package checkers in Phase 2+) publish, Intelligence
 * consumes — never the other way around.
 *
 * Phase 1 intentionally has no persistence and no distributed outbox: the
 * bus is an in-memory broadcast. A failing subscriber never breaks the
 * publisher (invariant: Intelligence can never block or break message flow).
 */
export class FrontlineEventBus {
  private subscribers = new Set<FrontlineEventSubscriber>()

  subscribe(subscriber: FrontlineEventSubscriber): () => void {
    this.subscribers.add(subscriber)
    return () => {
      this.subscribers.delete(subscriber)
    }
  }

  async publish(event: FrontlineEvent): Promise<void> {
    const full: FrontlineEvent = event.id ? event : { ...event, id: randomUUID() }
    await Promise.all(
      [...this.subscribers].map((subscriber) =>
        Promise.resolve(subscriber(full)).catch((error) => {
          console.error(`[frontline] event subscriber failed (${full.kind}):`, error)
        })
      )
    )
  }

  clear(): void {
    this.subscribers.clear()
  }
}

export const eventBus = new FrontlineEventBus()
