import type { WorkshopEvent } from '../types';

export interface DevelopmentRecord {
  sessionId: string;
  timestamp: string;
  duration?: number;
  changes: {
    filesChanged: string[];
    insertions: number;
    deletions: number;
  };
  validation: {
    build: boolean;
    lint: boolean;
    tests: boolean;
  };
  evidence: {
    errors: number;
    warnings: number;
    patterns: number;
    health: Record<string, number>;
  };
  summary: string;
  futureImpact: string;
  commitHash?: string;
  commitMessage?: string;
  relatedEvents?: WorkshopEvent[];
}

export class DevelopmentRecordBuilder {
  public build(params: Partial<DevelopmentRecord> & Pick<DevelopmentRecord, 'sessionId' | 'timestamp' | 'summary' | 'futureImpact'>): DevelopmentRecord {
    return {
      sessionId: params.sessionId,
      timestamp: params.timestamp,
      duration: params.duration,
      changes: {
        filesChanged: params.changes?.filesChanged ?? [],
        insertions: params.changes?.insertions ?? 0,
        deletions: params.changes?.deletions ?? 0,
      },
      validation: {
        build: params.validation?.build ?? false,
        lint: params.validation?.lint ?? false,
        tests: params.validation?.tests ?? false,
      },
      evidence: {
        errors: params.evidence?.errors ?? 0,
        warnings: params.evidence?.warnings ?? 0,
        patterns: params.evidence?.patterns ?? 0,
        health: params.evidence?.health ?? {},
      },
      summary: params.summary,
      futureImpact: params.futureImpact,
      commitHash: params.commitHash,
      commitMessage: params.commitMessage,
      relatedEvents: params.relatedEvents,
    };
  }
}
