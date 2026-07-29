import type { WorkshopEvent } from '../../types';
import type { IntelligenceRule, WorkshopFinding } from '../findings/finding-model';
import { ConfidenceCalculator } from '../scoring/confidence-calculator';
import { SeverityCalculator } from '../scoring/severity-calculator';

export class PerformanceRule implements IntelligenceRule {
  public readonly id = 'performance';
  public readonly name = 'Performance';

  private readonly confidenceCalculator = new ConfidenceCalculator();
  private readonly severityCalculator = new SeverityCalculator();

  public evaluate(events: WorkshopEvent[], sessionId: string): WorkshopFinding[] {
    const matches = events.filter((event) => event.action === 'long task' || (event.category === 'Performance' && typeof event.duration === 'number' && event.duration > 200));
    if (matches.length === 0) {
      return [];
    }

    const count = matches.length;
    return [{
      id: `${this.id}-${sessionId}-${count}`,
      timestamp: matches.at(-1)?.timestamp ?? new Date().toISOString(),
      sessionId,
      type: 'PERFORMANCE_ISSUE',
      severity: this.severityCalculator.calculate({ type: 'PERFORMANCE_ISSUE' }),
      confidence: this.confidenceCalculator.calculate(count),
      source: 'Workshop',
      module: matches[0]?.module ?? 'unknown',
      evidence: matches.map((event) => `${event.action} in ${event.module}`),
      metadata: { count, reason: 'performance issue observed' },
    }];
  }
}
