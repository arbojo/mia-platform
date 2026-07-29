import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { WorkshopEvent, WorkshopSessionReport } from '../types';
import type { EventAggregation } from '../collector/event-aggregator';
import type { SessionHealth } from '../runtime/health-indicators';
import type { PatternMatch } from '../collector/pattern-collector';
import type { IssueGroup } from '../collector/issue-grouper';
import type { SessionSummary } from '../snapshots/session-summary';
import type { SessionSnapshot } from '../snapshots/snapshot-engine';

export interface SessionArtifacts {
  eventsPath: string;
  snapshotPath: string;
  summaryPath: string;
  timelinePath: string;
  healthPath: string;
  reportPath: string;
  metricsPath: string;
}

export class SessionArtifactsWriter {
  constructor(private readonly sessionDir: string) {}

  public write(params: {
    events: WorkshopEvent[];
    snapshot: SessionSnapshot;
    summary: SessionSummary;
    timeline: Array<{ timestamp: string; label: string; source: string }>;
    health: SessionHealth;
    report: WorkshopSessionReport;
    metrics: EventAggregation;
    patterns: PatternMatch[];
    issues: IssueGroup[];
  }): SessionArtifacts {
    mkdirSync(this.sessionDir, { recursive: true });

    const eventsPath = path.join(this.sessionDir, 'events.jsonl');
    const snapshotPath = path.join(this.sessionDir, 'snapshot.json');
    const summaryPath = path.join(this.sessionDir, 'summary.json');
    const timelinePath = path.join(this.sessionDir, 'timeline.json');
    const healthPath = path.join(this.sessionDir, 'health.json');
    const reportPath = path.join(this.sessionDir, 'report.json');
    const metricsPath = path.join(this.sessionDir, 'metrics.json');

    writeFileSync(eventsPath, params.events.map((event) => JSON.stringify(event)).join('\n'));
    writeFileSync(snapshotPath, JSON.stringify(params.snapshot, null, 2));
    writeFileSync(summaryPath, JSON.stringify(params.summary, null, 2));
    writeFileSync(timelinePath, JSON.stringify(params.timeline, null, 2));
    writeFileSync(healthPath, JSON.stringify(params.health, null, 2));
    writeFileSync(reportPath, JSON.stringify(params.report, null, 2));
    writeFileSync(metricsPath, JSON.stringify({ metrics: params.metrics, patterns: params.patterns, issues: params.issues }, null, 2));

    return { eventsPath, snapshotPath, summaryPath, timelinePath, healthPath, reportPath, metricsPath };
  }
}
