import type { WorkshopEvent } from '../../types';
import type { IntelligenceRule, WorkshopFinding } from '../findings/finding-model';
import { ConfidenceCalculator } from '../scoring/confidence-calculator';
import { SeverityCalculator } from '../scoring/severity-calculator';

export class RepeatedErrorRule implements IntelligenceRule {
  public readonly id = 'repeated-error';
  public readonly name = 'Repeated Error';

  private readonly confidenceCalculator = new ConfidenceCalculator();
  private readonly severityCalculator = new SeverityCalculator();

  public evaluate(events: WorkshopEvent[], sessionId: string): WorkshopFinding[] {
    const group = events.reduce<Record<string, number>>((acc, event) => {
      const key = `${event.module}:${event.action}`;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    const repeated = Object.entries(group).filter(([, count]) => count > 1);
    if (repeated.length === 0) {
      return [];
    }

    const maxCount = repeated.reduce((highest, [, count]) => Math.max(highest, count), 0);
    return [{
      id: `${this.id}-${sessionId}-${maxCount}`,
      timestamp: events.at(-1)?.timestamp ?? new Date().toISOString(),
      sessionId,
      type: 'REPEATED_FAILURE_PATTERN',
      severity: this.severityCalculator.calculate({ type: 'REPEATED_FAILURE_PATTERN' }),
      confidence: this.confidenceCalculator.calculate(maxCount),
      source: 'Workshop',
      module: events[0]?.module ?? 'unknown',
      evidence: repeated.map(([key, count]) => `${key} x${count}`),
      metadata: { count: maxCount, reason: 'same failure repeated' },
    }];
  }
}
