import type { FindingSeverity, WorkshopFinding } from '../findings/finding-model';

export class SeverityCalculator {
  public calculate(finding: Partial<WorkshopFinding>): FindingSeverity {
    switch (finding.type) {
      case 'RUNTIME_FAILURE':
      case 'NAVIGATION_FAILURE':
        return 'high';
      case 'DEAD_INTERACTION':
        return 'medium';
      case 'PERFORMANCE_ISSUE':
        return 'medium';
      case 'REPEATED_FAILURE_PATTERN':
        return 'high';
      default:
        return 'low';
    }
  }
}
