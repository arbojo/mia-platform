import { randomUUID } from 'node:crypto';
import type { WorkshopEvent, WorkshopEventInput } from '../types';
import { createDefaultWorkshopConfig } from '../config';

export interface EventCollectorOptions {
  sessionId: string;
  dedupeWindowMs?: number;
}

export class EventCollector {
  private readonly sessionId: string;
  private readonly dedupeWindowMs: number;
  private readonly pendingEvents = new Map<string, WorkshopEvent>();

  constructor(options: EventCollectorOptions, dedupeWindowMs = createDefaultWorkshopConfig().dedupeWindowMs) {
    this.sessionId = options.sessionId;
    this.dedupeWindowMs = dedupeWindowMs;
  }

  public collect(input: WorkshopEventInput): WorkshopEvent[] {
    const event = this.normalize(input);
    const key = this.buildKey(event);
    const existing = this.pendingEvents.get(key);

    if (existing) {
      const existingTime = new Date(existing.timestamp).getTime();
      const currentTime = new Date(event.timestamp).getTime();

      if (currentTime - existingTime <= this.dedupeWindowMs) {
        const nextCount = Number(existing.metadata.count ?? 1) + 1;
        existing.metadata = {
          ...existing.metadata,
          count: nextCount,
          lastAction: event.action,
        };
        return [];
      }

      this.pendingEvents.delete(key);
      this.pendingEvents.set(key, event);
      return [existing];
    }

    this.pendingEvents.set(key, event);
    return [];
  }

  public flush(): WorkshopEvent[] {
    const emitted = Array.from(this.pendingEvents.values());
    this.pendingEvents.clear();
    return emitted;
  }

  private normalize(input: WorkshopEventInput): WorkshopEvent {
    const timestamp = input.timestamp ?? new Date().toISOString();
    return {
      id: randomUUID(),
      timestamp,
      sessionId: input.sessionId ?? this.sessionId,
      source: input.source ?? 'System',
      category: input.category,
      severity: input.severity ?? 'info',
      action: input.action,
      module: input.module,
      page: input.page,
      component: input.component,
      metadata: input.metadata ?? {},
      duration: input.duration,
    };
  }

  private buildKey(event: WorkshopEvent): string {
    return `${event.source}:${event.category}:${event.action}:${event.module}:${event.page ?? ''}:${event.component ?? ''}:${event.severity}`;
  }
}
