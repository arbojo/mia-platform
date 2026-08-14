import assert from 'node:assert/strict';
import { CouncilEngine } from '../council/core/council-engine';
import { Scheduler } from '../council/dispatcher/scheduler';
import { ParallelDispatcher } from '../council/dispatcher/parallel-dispatcher';
import { ResultCollector } from '../council/dispatcher/result-collector';
import { withTimeout, TimeoutError } from '../council/dispatcher/timeout-wrapper';
import { ArchitectRole } from '../council/roles/architect';
import { QARole } from '../council/roles/qa';
import type { CouncilContext, CouncilFinding, CouncilRole } from '../council/types';

async function main() {

const baseContext: CouncilContext = {
  sessionId: 'session-parallel-2',
  developmentRecord: {
    sessionId: 'session-parallel-2',
    timestamp: '2026-07-29T00:00:00.000Z',
    summary: 'Parallel execution Phase 2 test',
    futureImpact: 'Testing real parallel dispatch',
    validation: { build: true, lint: true, tests: true },
    changes: { filesChanged: ['workshop/council/dispatcher/parallel-dispatcher.ts'], insertions: 60, deletions: 35 },
    evidence: { errors: 0, warnings: 0, patterns: 1, health: { stability: 0.95, coverage: 0.9, traceability: 0.9 } },
  },
  evidenceSnapshot: {
    eventCount: 1,
    errorCount: 0,
    warningCount: 0,
    performanceSummary: { memorySpikes: 0, cpuSpikes: 0, apiDurationsMs: [] },
    modifiedFiles: ['workshop/council/dispatcher/parallel-dispatcher.ts'],
  },
  commitContext: { commitMessage: 'feat(workshop): parallel dispatcher async', status: 'ready' },
  changedFiles: ['workshop/council/dispatcher/parallel-dispatcher.ts'],
  validationResults: { build: true, lint: true, tests: true },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function finding(id: string, role: string, category: string): CouncilFinding {
  return {
    id,
    role,
    severity: 'low',
    category,
    title: 't',
    description: 'd',
    evidence: [] as string[],
    affectedArea: 'test',
    recommendation: 'r',
  };
}

// ───── 1. Real parallel execution ─────

{
  const dispatcher = new ParallelDispatcher();

  const roles: CouncilRole[] = [
    { id: 'slow-a', name: 'Slow A', responsibility: '', audit: async () => { await sleep(100); return []; } },
    { id: 'slow-b', name: 'Slow B', responsibility: '', audit: async () => { await sleep(100); return []; } },
    { id: 'slow-c', name: 'Slow C', responsibility: '', audit: async () => { await sleep(100); return []; } },
  ];

  const start = performance.now();
  const { wallClockMs } = await dispatcher.dispatch(roles, baseContext);
  const elapsed = performance.now() - start;

  // Parallel: 3 agents × 100ms should take ~100-150ms, NOT 300ms
  assert.ok(elapsed < 250, `Parallel took ${Math.round(elapsed)}ms, expected <250ms for 3×100ms agents`);
  assert.ok(wallClockMs < 250, `wallClockMs=${wallClockMs}, expected <250ms`);
  console.log(`1. Real parallel execution: ${Math.round(elapsed)}ms (<250ms) OK`);
}

// ───── 2. All agents receive same context ─────

{
  const dispatcher = new ParallelDispatcher();
  const received: number[] = [];

  const roles: CouncilRole[] = [
    { id: 'a', name: 'A', responsibility: '', audit: (ctx) => { received.push(ctx.changedFiles.length); return []; } },
    { id: 'b', name: 'B', responsibility: '', audit: (ctx) => { received.push(ctx.changedFiles.length); return []; } },
    { id: 'c', name: 'C', responsibility: '', audit: (ctx) => { received.push(ctx.changedFiles.length); return []; } },
  ];

  await dispatcher.dispatch(roles, baseContext);
  assert.equal(received.length, 3);
  assert.equal(received[0], received[1]);
  assert.equal(received[1], received[2]);
  console.log('2. All agents receive same context OK');
}

// ───── 3. Error isolation ─────

{
  const dispatcher = new ParallelDispatcher();

  const throwingRole: CouncilRole = {
    id: 'thrower', name: 'Thrower', responsibility: '',
    audit: () => { throw new Error('Agent failure'); },
  };
  const safeRole: CouncilRole = {
    id: 'safe', name: 'Safe', responsibility: '', audit: () => [],
  };

  const { results } = await dispatcher.dispatch([throwingRole, safeRole], baseContext);

  assert.equal(results.length, 2);
  assert.equal(results[0].roleId, 'thrower');
  assert.notEqual(results[0].error, null);
  assert.equal(results[0].findings.length, 0);
  assert.equal(results[1].roleId, 'safe');
  assert.equal(results[1].error, null);
  console.log('3. Error isolation OK');
}

// ───── 4. Per-agent timeout ─────

{
  const dispatcher = new ParallelDispatcher({ timeoutMs: 50 });

  const slowRole: CouncilRole = {
    id: 'slow', name: 'Slow', responsibility: '',
    audit: async () => { await sleep(500); return []; },
  };
  const fastRole: CouncilRole = {
    id: 'fast', name: 'Fast', responsibility: '', audit: () => [],
  };

  const { results } = await dispatcher.dispatch([slowRole, fastRole], baseContext);

  assert.equal(results.length, 2);
  assert.equal(results[0].roleId, 'slow');
  assert.notEqual(results[0].error, null);
  assert.ok(results[0].error!.includes('timed out') || results[0].error!.includes('Timeout'), `Got: ${results[0].error}`);
  assert.equal(results[1].roleId, 'fast');
  assert.equal(results[1].error, null);
  console.log('4. Per-agent timeout OK');
}

// ───── 5. Order preservation with varied delays ─────

{
  const dispatcher = new ParallelDispatcher({ timeoutMs: 5000 });

  const roles: CouncilRole[] = [
    { id: 'first', name: 'First', responsibility: '', audit: async () => { await sleep(100); return [finding('f1', 'First', 'order')]; } },
    { id: 'second', name: 'Second', responsibility: '', audit: async () => { await sleep(300); return [finding('f2', 'Second', 'order')]; } },
    { id: 'third', name: 'Third', responsibility: '', audit: async () => { await sleep(200); return [finding('f3', 'Third', 'order')]; } },
  ];

  const { results, wallClockMs } = await dispatcher.dispatch(roles, baseContext);

  // Order must be First → Second → Third (not by completion time)
  assert.equal(results[0].roleId, 'first');
  assert.equal(results[1].roleId, 'second');
  assert.equal(results[2].roleId, 'third');

  // Wall clock should be ~300ms (slowest agent), not 600ms (sum)
  assert.ok(wallClockMs < 500, `wallClockMs=${wallClockMs}, expected <500ms for max 300ms agent`);

  // Individual timings should reflect real durations
  assert.ok(results[0].durationMs >= 80 && results[0].durationMs <= 200, `First took ${results[0].durationMs}ms`);
  assert.ok(results[1].durationMs >= 280 && results[1].durationMs <= 500, `Second took ${results[1].durationMs}ms`);
  assert.ok(results[2].durationMs >= 180 && results[2].durationMs <= 400, `Third took ${results[2].durationMs}ms`);

  console.log('5. Order preservation with varied delays OK');
}

// ───── 6. Sync agent compatibility ─────

{
  const dispatcher = new ParallelDispatcher();
  const role: CouncilRole = {
    id: 'sync', name: 'Sync', responsibility: '',
    audit: () => [finding('s1', 'Sync', 'compat')],
  };

  const { results } = await dispatcher.dispatch([role], baseContext);

  assert.equal(results[0].roleId, 'sync');
  assert.equal(results[0].error, null);
  assert.equal(results[0].findings.length, 1);
  assert.equal(results[0].findings[0].id, 's1');
  console.log('6. Sync agent compatibility OK');
}

// ───── 7. Async agent compatibility ─────

{
  const dispatcher = new ParallelDispatcher();
  const role: CouncilRole = {
    id: 'async', name: 'Async', responsibility: '',
    audit: async () => [finding('a1', 'Async', 'compat')],
  };

  const { results } = await dispatcher.dispatch([role], baseContext);

  assert.equal(results[0].roleId, 'async');
  assert.equal(results[0].error, null);
  assert.equal(results[0].findings.length, 1);
  assert.equal(results[0].findings[0].id, 'a1');
  console.log('7. Async agent compatibility OK');
}

// ───── 8. withTimeout unit test ─────

{
  await withTimeout(Promise.resolve('ok'), 1000).then((v) => assert.equal(v, 'ok'));
  console.log('8a. withTimeout: resolves before timeout OK');

  let timedOut = false;
  try {
    await withTimeout(sleep(200), 50);
  } catch (e) {
    timedOut = e instanceof TimeoutError;
    assert.ok(timedOut);
  }
  assert.ok(timedOut);
  console.log('8b. withTimeout: rejects on timeout OK');
}

// ───── 9. CouncilEngine — async run ─────

{
  const engine = new CouncilEngine();
  const report = await engine.run(baseContext);

  assert.equal(report.sessionId, 'session-parallel-2');
  assert.ok(report.rolesExecuted.length >= 5);
  assert.ok(typeof report.summary === 'string');
  assert.equal(report.status, 'complete');
  assert.ok(Array.isArray(report.findings));
  console.log('9. CouncilEngine async run OK');
}

// ───── 10. CouncilEngine — error with partial status ─────

{
  const throwingRole: CouncilRole = {
    id: 'thrower', name: 'Thrower', responsibility: '',
    audit: () => { throw new Error('fail'); },
  };
  const engine = new CouncilEngine([new ArchitectRole(), throwingRole, new QARole()]);
  const report = await engine.run(baseContext);

  assert.equal(report.status, 'partial');
  assert.ok(report.rolesFailed !== undefined);
  assert.equal(report.rolesFailed[0], 'Thrower');
  console.log('10. CouncilEngine partial status OK');
}

// ───── 11. CouncilEngine — performanceMs wall clock ─────

{
  const slowRole: CouncilRole = {
    id: 'slow', name: 'Slow', responsibility: '',
    audit: async () => { await sleep(80); return []; },
  };
  const roles = [slowRole, new ArchitectRole(), new QARole()];
  const engine = new CouncilEngine(roles);
  const report = await engine.run(baseContext);

  assert.ok(report.performanceMs !== undefined);
  assert.ok(report.performanceMs >= 0);
  // Wall clock should be ~80ms (slowest), not sum of all agent durations
  assert.ok(report.performanceMs < 150, `performanceMs=${report.performanceMs}, expected <150ms for 80ms slowest agent`);
  console.log(`11. CouncilEngine wall clock: ${report.performanceMs}ms OK`);
}

// ───── 12. Scheduler — unchanged ─────

{
  const scheduler = new Scheduler();
  const result = scheduler.schedule([new ArchitectRole(), new QARole()], baseContext);
  assert.equal(result.rolesToExecute.length, 2);
  assert.equal(result.rolesToExecute[0].id, 'architect');
  console.log('12. Scheduler unchanged OK');
}

// ───── 13. ResultCollector — unchanged interface ─────

{
  const collector = new ResultCollector();
  const workerResults = [
    { roleId: 'architect', roleName: 'Architect', findings: [finding('f1', 'Architect', 'test')], durationMs: 5, error: null },
    { roleId: 'qa', roleName: 'QA', findings: [], durationMs: 3, error: null },
  ];
  const collected = collector.collect(workerResults, 300);

  assert.equal(collected.rolesExecuted[0], 'Architect');
  assert.equal(collected.rolesExecuted[1], 'QA');
  assert.equal(collected.findings.length, 1);
  assert.equal(collected.totalDurationMs, 8);
  assert.equal(collected.wallClockMs, 300);
  console.log('13. ResultCollector unchanged interface OK');
}

// ───── 14. Performance metric — sequential vs parallel ─────

{
  const roles: CouncilRole[] = [
    { id: 'a', name: 'A', responsibility: '', audit: async () => { await sleep(60); return []; } },
    { id: 'b', name: 'B', responsibility: '', audit: async () => { await sleep(60); return []; } },
    { id: 'c', name: 'C', responsibility: '', audit: async () => { await sleep(60); return []; } },
    { id: 'd', name: 'D', responsibility: '', audit: async () => { await sleep(60); return []; } },
  ];

  // Sequential baseline
  const seqStart = performance.now();
  for (const role of roles) {
    await Promise.resolve(role.audit(baseContext));
  }
  const seqTime = performance.now() - seqStart;

  // Parallel
  const dispatcher = new ParallelDispatcher();
  const parStart = performance.now();
  const { wallClockMs } = await dispatcher.dispatch(roles, baseContext);
  const parTime = performance.now() - parStart;

  const improvement = ((seqTime - parTime) / seqTime * 100).toFixed(1);

  assert.ok(parTime < seqTime, `Parallel (${Math.round(parTime)}ms) should be faster than sequential (${Math.round(seqTime)}ms)`);
  assert.ok(wallClockMs < 150, `wallClockMs=${wallClockMs}, expected <150ms for 4×60ms agents`);

  console.log(`\n── Performance metrics ──`);
  console.log(`  Sequential (4×60ms): ${Math.round(seqTime)}ms`);
  console.log(`  Parallel:            ${Math.round(parTime)}ms (wallClockMs: ${wallClockMs}ms)`);
  console.log(`  Improvement:         ${improvement}%`);
  console.log(`  Expected seq:        ~240ms`);
  console.log(`  Expected parallel:   ~60-80ms`);
  console.log(`14. Performance metric OK`);
}

console.log('\nAll parallel execution Phase 2 tests OK');
}

main().catch(console.error);
