import type { WorkshopEvent } from '../types';

export class SessionTimeline {
  public build(events: WorkshopEvent[]): Array<{ timestamp: string; label: string; source: string }> {
    return events.map((event) => ({
      timestamp: event.timestamp,
      label: `${event.action}`,
      source: event.source,
    }));
  }
}
