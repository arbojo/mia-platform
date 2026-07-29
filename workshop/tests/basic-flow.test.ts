import assert from 'node:assert/strict';
import { EventCollector } from '../collector/event-collector';
import { JsonlRecorder } from '../recorder/jsonl-recorder';
import { SessionLifecycle } from '../runtime/session-lifecycle';
import { SessionReportGenerator } from '../snapshots/session-report-generator';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'mia-workshop-'));

try {
  const sessionLifecycle = new SessionLifecycle({ baseDir: tempDir });
  const session = sessionLifecycle.start();
  const collector = new EventCollector({ sessionId: session.id });
  const recorder = new JsonlRecorder({ directory: session.sessionDir });

  const first = collector.collect({ category: 'UI', severity: 'info', action: 'button clicked', module: 'dashboard' });
  assert.equal(first.length, 0);

  const second = collector.collect({ category: 'UI', severity: 'info', action: 'button clicked', module: 'dashboard' });
  assert.equal(second.length, 0);

  const emitted = collector.flush();
  assert.equal(emitted.length, 1);
  recorder.appendMany(emitted);

  const report = new SessionReportGenerator({ sessionDir: session.sessionDir, eventFilePath: path.join(session.sessionDir, 'events.jsonl') }).generate(emitted);
  assert.equal(report.general.eventCount, 1);
  assert.ok(existsSync(path.join(session.sessionDir, 'session-report.json')));

  sessionLifecycle.end('ended');
  console.log('Workshop basic flow OK');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
