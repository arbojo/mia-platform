import assert from 'node:assert/strict';
import { CouncilEngine } from '../council/core/council-engine';
import type { CouncilContext } from '../council/types';

const context: CouncilContext = {
  sessionId: 'session-council-1',
  developmentRecord: {
    sessionId: 'session-council-1',
    timestamp: '2026-07-29T00:00:00.000Z',
    summary: 'Added dashboard workflow updates',
    futureImpact: 'Future work will depend on the new dashboard structure',
    validation: { build: true, lint: true, tests: true },
    changes: { filesChanged: ['src/app/dashboard/page.tsx', 'src/components/dashboard/Sidebar.tsx'], insertions: 18, deletions: 4 },
    evidence: { errors: 0, warnings: 1, patterns: 2, health: { stability: 0.9, coverage: 0.8, traceability: 0.85 } },
  },
  evidenceSnapshot: {
    eventCount: 4,
    errorCount: 1,
    warningCount: 1,
    performanceSummary: { memorySpikes: 1, cpuSpikes: 0, apiDurationsMs: [120, 180] },
    modifiedFiles: ['src/app/dashboard/page.tsx', 'src/components/dashboard/Sidebar.tsx'],
  },
  commitContext: { commitMessage: 'feat(ui): update dashboard flow', status: 'ready' },
  changedFiles: ['src/app/dashboard/page.tsx', 'src/components/dashboard/Sidebar.tsx'],
  validationResults: {
    build: true,
    lint: true,
    tests: true,
  },
};

const engine = new CouncilEngine();
const report = engine.run(context);

assert.equal(report.sessionId, 'session-council-1');
assert.ok(report.rolesExecuted.length >= 5);
assert.ok(report.findings.length > 0);
assert.equal(report.status, 'complete');
assert.ok(report.summary.includes('Findings'));

console.log('Council flow OK');
