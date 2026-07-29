import type { IntelligenceRule } from '../findings/finding-model';

export class RuleRegistry {
  private readonly rules: IntelligenceRule[] = [];

  public registerRule(rule: IntelligenceRule): void {
    this.rules.push(rule);
  }

  public getRules(): IntelligenceRule[] {
    return this.rules;
  }
}
