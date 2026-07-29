import type { WorkshopEvent } from '../types';

export interface IssueGroup {
  key: string;
  label: string;
  events: WorkshopEvent[];
}

export class IssueGrouper {
  public group(events: WorkshopEvent[]): IssueGroup[] {
    const groups: IssueGroup[] = [];

    const incidents = this.groupBy(events.filter((event) => event.category === 'Errors' || event.category === 'Runtime' || event.category === 'Navigation' || event.action === 'dead interaction'), 'action');

    for (const [key, items] of Object.entries(incidents)) {
      if (items.length > 0) {
        groups.push({ key, label: this.labelFor(key), events: items });
      }
    }

    return groups;
  }

  private groupBy(events: WorkshopEvent[], field: 'action'): Record<string, WorkshopEvent[]> {
    return events.reduce<Record<string, WorkshopEvent[]>>((acc, event) => {
      const key = event[field] ?? 'unknown';
      acc[key] = acc[key] ?? [];
      acc[key].push(event);
      return acc;
    }, {});
  }

  private labelFor(action: string): string {
    if (action === 'runtime error') return 'Runtime Incident';
    if (action === 'dead interaction') return 'Dead Interaction Incident';
    if (action === 'route change') return 'Navigation Incident';
    return action;
  }
}
