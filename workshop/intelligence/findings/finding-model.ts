import type { WorkshopEvent } from '../../types';

export type FindingSeverity = 'low' | 'medium' | 'high' | 'critical';
export type FindingType = 'DEAD_INTERACTION' | 'NAVIGATION_FAILURE' | 'RUNTIME_FAILURE' | 'PERFORMANCE_ISSUE' | 'REPEATED_FAILURE_PATTERN';

export interface WorkshopFinding {
  id: string;
  timestamp: string;
  sessionId: string;
  type: FindingType;
  severity: FindingSeverity;
  confidence: number;
  source: string;
  module: string;
  evidence: string[];
  metadata: Record<string, unknown>;
}

export interface IntelligenceRule {
  readonly id: string;
  readonly name: string;
  evaluate(events: WorkshopEvent[], sessionId: string): WorkshopFinding[];
}
