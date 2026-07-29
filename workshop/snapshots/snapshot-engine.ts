import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { WorkshopEvent, WorkshopEventMetadata } from '../types';

export interface SnapshotEngineOptions {
  sessionDir: string;
  outputFileName?: string;
}

export interface SessionSnapshot {
  createdAt: string;
  eventCount: number;
  warnings: number;
  errors: number;
  topActions: Array<{ action: string; count: number }>;
  modules: Record<string, number>;
  pages: string[];
  metadata: WorkshopEventMetadata;
}

export class SnapshotEngine {
  constructor(private readonly options: SnapshotEngineOptions) {}

  public create(events: WorkshopEvent[], metadata: WorkshopEventMetadata = {}): SessionSnapshot {
    const snapshot: SessionSnapshot = {
      createdAt: new Date().toISOString(),
      eventCount: events.length,
      warnings: events.filter((event) => event.severity === 'warning').length,
      errors: events.filter((event) => event.severity === 'error' || event.severity === 'critical').length,
      topActions: this.topActions(events),
      modules: this.countBy(events, 'module'),
      pages: [...new Set(events.map((event) => event.page).filter(Boolean) as string[])],
      metadata,
    };

    mkdirSync(this.options.sessionDir, { recursive: true });
    writeFileSync(path.join(this.options.sessionDir, this.options.outputFileName ?? 'snapshot.json'), JSON.stringify(snapshot, null, 2));
    return snapshot;
  }

  private topActions(events: WorkshopEvent[]): Array<{ action: string; count: number }> {
    const counts = events.reduce<Record<string, number>>((acc, event) => {
      acc[event.action] = (acc[event.action] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }));
  }

  private countBy(events: WorkshopEvent[], field: 'module'): Record<string, number> {
    return events.reduce<Record<string, number>>((acc, event) => {
      acc[event[field]] = (acc[event[field]] ?? 0) + 1;
      return acc;
    }, {});
  }
}
