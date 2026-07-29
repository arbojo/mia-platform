import type { WorkshopEventInput } from '../../types';

export interface DeadInteractionDetectorOptions {
  sessionId: string;
  emit: (event: WorkshopEventInput) => void;
  timeoutMs?: number;
  module?: string;
}

interface PendingInteraction {
  key: string;
  component?: string;
  route?: string;
  timeoutId: ReturnType<typeof setTimeout>;
  startedAt: number;
}

export class DeadInteractionDetector {
  private readonly sessionId: string;
  private readonly emit: (event: WorkshopEventInput) => void;
  private readonly timeoutMs: number;
  private readonly module: string;
  private readonly pending = new Map<string, PendingInteraction>();
  private readonly counters = new Map<string, number>();

  constructor(options: DeadInteractionDetectorOptions) {
    this.sessionId = options.sessionId;
    this.emit = options.emit;
    this.timeoutMs = options.timeoutMs ?? 1_500;
    this.module = options.module ?? 'ui';
  }

  public trackInteraction(input: { key: string; component?: string; route?: string; action?: string; metadata?: Record<string, unknown> }): void {
    const interactionKey = input.key;
    const count = (this.counters.get(interactionKey) ?? 0) + 1;
    this.counters.set(interactionKey, count);

    const existing = this.pending.get(interactionKey);
    if (existing) {
      clearTimeout(existing.timeoutId);
    }

    const timeoutId = setTimeout(() => {
      this.emit({
        sessionId: this.sessionId,
        category: 'UI',
        severity: count >= 3 ? 'warning' : 'info',
        action: count >= 3 ? 'repeated dead interaction' : 'dead interaction',
        module: this.module,
        component: input.component,
        metadata: {
          key: interactionKey,
          route: input.route,
          count,
          action: input.action ?? 'interaction',
          ...input.metadata,
        },
      });
      this.pending.delete(interactionKey);
    }, this.timeoutMs);

    this.pending.set(interactionKey, {
      key: interactionKey,
      component: input.component,
      route: input.route,
      timeoutId,
      startedAt: Date.now(),
    });
  }

  public resolve(key: string): void {
    const pending = this.pending.get(key);
    if (pending) {
      clearTimeout(pending.timeoutId);
      this.pending.delete(key);
    }
  }
}
