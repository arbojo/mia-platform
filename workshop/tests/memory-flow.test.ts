import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DevelopmentRecordBuilder } from '../memory/development-record';
import { ChangeSummaryGenerator } from '../memory/change-summary';
import { CommitTemplateSystem } from '../memory/commit-template';
import { CommitGate } from '../memory/commit-gate';
import { DevelopmentMemoryArtifactWriter } from '../memory/development-memory-artifact';

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'mia-workshop-memory-'));

try {
  const record = new DevelopmentRecordBuilder().build({
    sessionId: 'session-1',
    timestamp: '2026-01-01T00:00:00.000Z',
    summary: 'Add evidence engine',
    futureImpact: 'Future Council agents can consume evidence',
    changes: { filesChanged: ['a.ts', 'b.ts'], insertions: 10, deletions: 2 },
    validation: { build: true, lint: true, tests: true },
    evidence: { errors: 0, warnings: 1, patterns: 1, health: { runtimeStability: 88 } },
  });

  const summary = new ChangeSummaryGenerator().generate(record);
  assert.ok(summary.includes('feat(workshop):'));

  const template = new CommitTemplateSystem().render({
    type: 'feat',
    scope: 'workshop',
    description: 'add evidence engine',
    why: 'Structured evidence is needed',
    implemented: ['Snapshot Engine', 'Event Aggregator'],
    validation: ['Build', 'Tests'],
    impact: 'Future agents can consume evidence',
    future: 'More artifacts will be added',
  });
  assert.ok(template.includes('Why:'));

  const gate = new CommitGate().validate({ code: true, build: true, lint: true, tests: true, evidence: true, commit: true });
  assert.equal(gate.ok, true);

  const artifacts = new DevelopmentMemoryArtifactWriter(tempDir).write(record, { commitHash: 'abc123', sessionId: 'session-1' });
  assert.ok(existsSync(artifacts.developmentRecordPath));
  assert.ok(existsSync(artifacts.commitContextPath));

  console.log('Memory flow OK');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
