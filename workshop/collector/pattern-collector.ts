import type { WorkshopEvent } from '../types';

export interface PatternMatch {
  type: 'repeated-error' | 'repeated-route' | 'repeated-dead-interaction' | 'repeated-api-slow' | 'repeated-warning';
  key: string;
  count: number;
  events: WorkshopEvent[];
}

export class PatternCollector {
  public collect(events: WorkshopEvent[]): PatternMatch[] {
    const matches: PatternMatch[] = [];

    const errors = this.groupBy(events.filter((event) => event.severity === 'error' || event.severity === 'critical'), 'action');
    const routes = this.groupBy(events.filter((event) => event.category === 'Navigation'), 'page');
    const dead = this.groupBy(events.filter((event) => event.action === 'dead interaction' || event.action === 'repeated dead interaction'), 'action');
    const warnings = this.groupBy(events.filter((event) => event.severity === 'warning'), 'action');

    for (const [key, eventList] of Object.entries(errors)) {
      if (eventList.length >= 2) {
        matches.push({ type: 'repeated-error', key, count: eventList.length, events: eventList });
      }
    }

    for (const [key, eventList] of Object.entries(routes)) {
      if (eventList.length >= 2) {
        matches.push({ type: 'repeated-route', key, count: eventList.length, events: eventList });
      }
    }

    for (const [key, eventList] of Object.entries(dead)) {
      if (eventList.length >= 2) {
        matches.push({ type: 'repeated-dead-interaction', key, count: eventList.length, events: eventList });
      }
    }

    for (const [key, eventList] of Object.entries(warnings)) {
      if (eventList.length >= 2) {
        matches.push({ type: 'repeated-warning', key, count: eventList.length, events: eventList });
      }
    }

    return matches;
  }

  private groupBy(events: WorkshopEvent[], field: 'action' | 'page'): Record<string, WorkshopEvent[]> {
    return events.reduce<Record<string, WorkshopEvent[]>>((acc, event) => {
      const key = event[field] ?? 'unknown';
      acc[key] = acc[key] ?? [];
      acc[key].push(event);
      return acc;
    }, {});
  }
}
