import type { WorkshopEvent } from '../../types';
import type { IntelligenceRule, WorkshopFinding } from '../findings/finding-model';
import { ConfidenceCalculator } from '../scoring/confidence-calculator';
import { SeverityCalculator } from '../scoring/severity-calculator';

export class RuntimeErrorRule implements IntelligenceRule {
  public readonly id = 'runtime-error';
  public readonly name = 'Runtime Error';

  private readonly confidenceCalculator = new ConfidenceCalculator();
  private readonly severityCalculator = new SeverityCalculator();

  public evaluate(events: WorkshopEvent[], sessionId: string): WorkshopFinding[] {
    const matches = events.filter((event) => event.action === 'runtime failure' || event.action === 'console error');
    if (matches.length === 0) {
      return [];
    }

    const count = matches.length;
    return [{
      id: `${this.id}-${sessionId}-${count}`,
      timestamp: matches.at(-1)?.timestamp ?? new Date().toISOString(),
      sessionId,
      type: 'RUNTIME_FAILURE',
      severity: this.severityCalculator.calculate({ type: 'RUNTIME_FAILURE' }),
      confidence: this.confidenceCalculator.calculate(count),
      source: 'Workshop',
      module: matches[0]?.module ?? 'unknown',
      evidence: matches.map((event) => `${event.action} in ${event.module}`),
      metadata: { count, reason: 'runtime failure observed' },
    }];
  }
}
