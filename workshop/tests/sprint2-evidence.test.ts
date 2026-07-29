import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { EventAggregator } from '../collector/event-aggregator';
import { IssueGrouper } from '../collector/issue-grouper';
import { PatternCollector } from '../collector/pattern-collector';
import { SessionHealthCalculator } from '../runtime/health-indicators';
import { SnapshotEngine } from '../snapshots/snapshot-engine';
import { SessionSummaryBuilder } from '../snapshots/session-summary';
import { SessionArtifactsWriter } from '../snapshots/session-artifacts';
import { SessionTimeline } from '../runtime/session-timeline';
import { SessionReportGenerator } from '../snapshots/session-report-generator';
import type { WorkshopEvent } from '../types';

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'mia-workshop-sprint2-'));

try {
  const events: WorkshopEvent[] = [
    { id: '1', timestamp: '2026-01-01T00:00:00.000Z', sessionId: 'session-a', source: 'Browser', category: 'UI', severity: 'info', action: 'click', module: 'dashboard', page: '/dashboard', metadata: {} },
    { id: '2', timestamp: '2026-01-01T00:00:01.000Z', sessionId: 'session-a', source: 'Runtime', category: 'Errors', severity: 'error', action: 'runtime error', module: 'runtime', page: '/dashboard', metadata: {} },
    { id: '3', timestamp: '2026-01-01T00:00:02.000Z', sessionId: 'session-a', source: 'Backend', category: 'API', severity: 'warning', action: 'request started', module: 'api', page: '/dashboard', duration: 120, metadata: {} },
  ];

  const snapshotEngine = new SnapshotEngine({ sessionDir: tempDir });
  const snapshot = snapshotEngine.create(events, { source: 'test' });
  assert.equal(snapshot.eventCount, 3);

  const aggregator = new EventAggregator();
  const aggregated = aggregator.aggregate(events);
  assert.equal(aggregated.totals.events, 3);

  const summary = new SessionSummaryBuilder().build(events);
  assert.equal(summary.eventCount, 3);

  const patterns = new PatternCollector().collect(events);
  const issues = new IssueGrouper().group(events);
  const health = new SessionHealthCalculator().calculate(events);
  const timeline = new SessionTimeline().build(events);
  const report = new SessionReportGenerator({ sessionDir: tempDir, eventFilePath: path.join(tempDir, 'events.jsonl') }).generate(events);

  const artifacts = new SessionArtifactsWriter(tempDir).write({
    events,
    snapshot,
    summary,
    timeline,
    health,
    report,
    metrics: aggregated,
    patterns,
    issues,
  });

  assert.ok(existsSync(artifacts.snapshotPath));
  assert.ok(existsSync(artifacts.summaryPath));
  assert.ok(existsSync(artifacts.timelinePath));
  assert.ok(existsSync(artifacts.healthPath));
  assert.ok(existsSync(artifacts.reportPath));
  assert.ok(existsSync(artifacts.metricsPath));

  console.log('Sprint 2 evidence flow OK');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
