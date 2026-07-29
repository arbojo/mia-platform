export type EventSource =
  | 'Frontend'
  | 'Backend'
  | 'Database'
  | 'AI'
  | 'WhatsApp'
  | 'Build'
  | 'Git'
  | 'Tests'
  | 'Runtime'
  | 'Browser'
  | 'Infrastructure'
  | 'System'
  | 'Developer';

export type EventCategory =
  | 'UI'
  | 'Navigation'
  | 'Runtime'
  | 'API'
  | 'Database'
  | 'Authentication'
  | 'Build'
  | 'Tests'
  | 'Git'
  | 'Performance'
  | 'Errors'
  | 'Warnings'
  | 'Developer'
  | 'Infrastructure'
  | 'System';

export type EventSeverity = 'debug' | 'info' | 'warning' | 'error' | 'critical';

export interface WorkshopEventMetadata {
  [key: string]: unknown;
}

export interface WorkshopEvent {
  id: string;
  timestamp: string;
  sessionId: string;
  source: EventSource;
  category: EventCategory;
  severity: EventSeverity;
  action: string;
  module: string;
  page?: string;
  component?: string;
  metadata: WorkshopEventMetadata;
  duration?: number;
}

export interface WorkshopEventInput {
  sessionId?: string;
  source?: EventSource;
  category: EventCategory;
  severity?: EventSeverity;
  action: string;
  module: string;
  page?: string;
  component?: string;
  metadata?: WorkshopEventMetadata;
  duration?: number;
  timestamp?: string;
}

export interface DevelopmentSession {
  id: string;
  startedAt: string;
  endedAt?: string;
  status: 'active' | 'ended' | 'stopped' | 'inactive';
  metadata: WorkshopEventMetadata;
  sessionDir: string;
}

export interface WorkshopSessionReport {
  sessionId: string;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  general: {
    eventCount: number;
    categories: Record<string, number>;
    severities: Record<string, number>;
    warnings: number;
    errors: number;
  };
  visitedPages: string[];
  buildSummary: {
    started: number;
    finished: number;
    failed: number;
    durationsMs: number[];
  };
  testSummary: {
    started: number;
    finished: number;
    failed: number;
    coverage: number[];
  };
  performanceSummary: {
    memorySpikes: number;
    cpuSpikes: number;
    apiDurationsMs: number[];
  };
  errorSummary: {
    runtimeFailures: number;
    deadInteractions: number;
    consoleErrors: number;
  };
  deadInteractions: Array<WorkshopEvent>;
  runtimeFailures: Array<WorkshopEvent>;
  modifiedFiles: string[];
  gitInfo: {
    branch?: string;
    latestCommit?: string;
  };
  statistics: {
    uniqueModules: string[];
    mostCommonActions: Array<{ action: string; count: number }>;
  };
  timeline: WorkshopEvent[];
}
