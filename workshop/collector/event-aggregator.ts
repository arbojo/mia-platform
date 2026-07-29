import type { WorkshopEvent } from '../types';

export interface EventAggregation {
  totals: {
    events: number;
    clicks: number;
    successfulClicks: number;
    deadInteractions: number;
    errors: number;
    warnings: number;
    requests: number;
    navigationChanges: number;
    longTasks: number;
  };
  byModule: Record<string, number>;
  byCategory: Record<string, number>;
  byMinute: Array<{ minute: string; count: number }>;
  averageApiDurationMs: number;
  topPages: Array<{ page: string; count: number }>;
}

export class EventAggregator {
  public aggregate(events: WorkshopEvent[]): EventAggregation {
    const byMinute = this.groupByMinute(events);
    const byModule = this.countBy(events, 'module');
    const byCategory = this.countBy(events, 'category');
    const apiDurations = events.filter((event) => event.category === 'API' && typeof event.duration === 'number').map((event) => event.duration as number);

    return {
      totals: {
        events: events.length,
        clicks: events.filter((event) => event.action === 'click').length,
        successfulClicks: events.filter((event) => event.action === 'click' && event.severity !== 'warning').length,
        deadInteractions: events.filter((event) => event.action === 'dead interaction' || event.action === 'repeated dead interaction').length,
        errors: events.filter((event) => event.severity === 'error' || event.severity === 'critical').length,
        warnings: events.filter((event) => event.severity === 'warning').length,
        requests: events.filter((event) => event.category === 'API').length,
        navigationChanges: events.filter((event) => event.action === 'route change').length,
        longTasks: events.filter((event) => event.action === 'long task').length,
      },
      byModule,
      byCategory,
      byMinute,
      averageApiDurationMs: apiDurations.length > 0 ? apiDurations.reduce((sum, duration) => sum + duration, 0) / apiDurations.length : 0,
      topPages: this.topPages(events),
    };
  }

  private countBy(events: WorkshopEvent[], field: 'module' | 'category'): Record<string, number> {
    return events.reduce<Record<string, number>>((acc, event) => {
      const key = event[field];
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }

  private groupByMinute(events: WorkshopEvent[]): Array<{ minute: string; count: number }> {
    const counts = events.reduce<Record<string, number>>((acc, event) => {
      const minute = event.timestamp.slice(0, 16);
      acc[minute] = (acc[minute] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([minute, count]) => ({ minute, count }));
  }

  private topPages(events: WorkshopEvent[]): Array<{ page: string; count: number }> {
    const counts = events.reduce<Record<string, number>>((acc, event) => {
      if (!event.page) {
        return acc;
      }
      acc[event.page] = (acc[event.page] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([page, count]) => ({ page, count }));
  }
}
