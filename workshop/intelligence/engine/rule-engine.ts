import type { WorkshopEvent } from '../../types';
import type { WorkshopFinding } from '../findings/finding-model';
import { RuleRegistry } from './rule-registry';

export interface RuleEngineResult {
  findings: WorkshopFinding[];
  ruleCount: number;
}

export class RuleEngine {
  constructor(private readonly registry: RuleRegistry = new RuleRegistry()) {}

  public run(events: WorkshopEvent[], sessionId: string): RuleEngineResult {
    const findings = this.registry.getRules().flatMap((rule) => rule.evaluate(events, sessionId));
    return { findings, ruleCount: this.registry.getRules().length };
  }
}
