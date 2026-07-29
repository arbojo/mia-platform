import type { WorkshopEvent, WorkshopEventMetadata } from '../types';

export interface SessionSummary {
  durationMs?: number;
  activeTimeMs?: number;
  inactiveTimeMs?: number;
  pages: string[];
  components: string[];
  eventCount: number;
  errors: number;
  warnings: number;
  builds: number;
  tests: number;
  deadInteractions: number;
  navigations: number;
  performanceEvents: number;
  metadata: WorkshopEventMetadata;
}

export class SessionSummaryBuilder {
  public build(events: WorkshopEvent[], metadata: WorkshopEventMetadata = {}): SessionSummary {
    const sorted = [...events].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const first = sorted[0];
    const last = sorted.at(-1);

    return {
      durationMs: first && last ? new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime() : undefined,
      activeTimeMs: first && last ? new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime() : undefined,
      inactiveTimeMs: 0,
      pages: [...new Set(sorted.map((event) => event.page).filter(Boolean) as string[])],
      components: [...new Set(sorted.map((event) => event.component).filter(Boolean) as string[])],
      eventCount: sorted.length,
      errors: sorted.filter((event) => event.severity === 'error' || event.severity === 'critical').length,
      warnings: sorted.filter((event) => event.severity === 'warning').length,
      builds: sorted.filter((event) => event.category === 'Build').length,
      tests: sorted.filter((event) => event.category === 'Tests').length,
      deadInteractions: sorted.filter((event) => event.action === 'dead interaction' || event.action === 'repeated dead interaction').length,
      navigations: sorted.filter((event) => event.category === 'Navigation').length,
      performanceEvents: sorted.filter((event) => event.category === 'Performance').length,
      metadata,
    };
  }
}
