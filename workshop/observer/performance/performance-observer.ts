import type { WorkshopEventInput } from '../../types';

export interface PerformanceObserverOptions {
  sessionId: string;
  emit: (event: WorkshopEventInput) => void;
}

export class WorkshopPerformanceObserver {
  private readonly sessionId: string;
  private readonly emit: (event: WorkshopEventInput) => void;
  private attached = false;

  constructor(options: PerformanceObserverOptions) {
    this.sessionId = options.sessionId;
    this.emit = options.emit;
  }

  public attach(): void {
    if (this.attached || typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') {
      return;
    }

    this.attached = true;
    const observer = new globalThis.PerformanceObserver((list: PerformanceObserverEntryList) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'longtask') {
          this.emit({
            sessionId: this.sessionId,
            source: 'Runtime',
            category: 'Performance',
            severity: 'warning',
            action: 'long task',
            module: 'performance',
            metadata: { name: entry.name, duration: entry.duration },
          });
        }
      }
    });

    observer.observe({ entryTypes: ['longtask'] });
  }

  public destroy(): void {
    this.attached = false;
  }
}
