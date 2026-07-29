export type CouncilSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface CouncilFinding {
  id: string;
  role: string;
  severity: CouncilSeverity;
  category: string;
  title: string;
  description: string;
  evidence: string[];
  affectedArea: string;
  recommendation: string;
}

export interface CouncilContext {
  sessionId: string;
  developmentRecord: {
    sessionId: string;
    timestamp: string;
    summary: string;
    futureImpact: string;
    validation: {
      build: boolean;
      lint: boolean;
      tests: boolean;
    };
    changes: {
      filesChanged: string[];
      insertions: number;
      deletions: number;
    };
    evidence: {
      errors: number;
      warnings: number;
      patterns: number;
      health: Record<string, number>;
    };
  };
  evidenceSnapshot: {
    eventCount: number;
    errorCount: number;
    warningCount: number;
    performanceSummary: {
      memorySpikes: number;
      cpuSpikes: number;
      apiDurationsMs: number[];
    };
    modifiedFiles: string[];
  };
  commitContext: Record<string, unknown>;
  changedFiles: string[];
  validationResults: {
    build: boolean;
    lint: boolean;
    tests: boolean;
  };
  artifacts?: string[];
  git?: Record<string, unknown>;
  affectedModules?: string[];
  timeline?: string[];
}

export interface CouncilRole {
  id: string;
  name: string;
  responsibility: string;
  audit(context: CouncilContext): CouncilFinding[];
}

export interface CouncilAuditReport {
  sessionId: string;
  timestamp: string;
  rolesExecuted: string[];
  findings: CouncilFinding[];
  summary: string;
  status: 'complete' | 'partial';
}
