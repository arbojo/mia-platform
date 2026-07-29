import type { WorkshopEvent } from '../../types';
import type { IntelligenceRule, WorkshopFinding } from '../findings/finding-model';
import { ConfidenceCalculator } from '../scoring/confidence-calculator';
import { SeverityCalculator } from '../scoring/severity-calculator';

export class DeadInteractionRule implements IntelligenceRule {
  public readonly id = 'dead-interaction';
  public readonly name = 'Dead Interaction';

  private readonly confidenceCalculator = new ConfidenceCalculator();
  private readonly severityCalculator = new SeverityCalculator();

  public evaluate(events: WorkshopEvent[], sessionId: string): WorkshopFinding[] {
    const matches = events.filter((event) => event.action === 'click' || event.action === 'dead interaction');
    if (matches.length === 0) {
      return [];
    }

    const count = matches.length;
    return [{
      id: `${this.id}-${sessionId}-${count}`,
      timestamp: matches.at(-1)?.timestamp ?? new Date().toISOString(),
      sessionId,
      type: 'DEAD_INTERACTION',
      severity: this.severityCalculator.calculate({ type: 'DEAD_INTERACTION' }),
      confidence: this.confidenceCalculator.calculate(count),
      source: 'Workshop',
      module: matches[0]?.module ?? 'unknown',
      evidence: matches.map((event) => `${event.action} in ${event.module}`),
      metadata: { count, reason: 'interaction without observable response' },
    }];
  }
}
