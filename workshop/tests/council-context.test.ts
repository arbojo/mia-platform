import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { CouncilContextBuilder } from '../council/council-context';
import { MemoryArtifactWriter } from '../memory/memory-artifact-writer';
import { GitAdapter } from '../git/git-adapter';

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'mia-workshop-council-'));
const sessionDir = path.join(tempDir, 'session-a');

try {
  mkdirSync(sessionDir, { recursive: true });

  const gitDir = path.join(tempDir, 'repo');
  mkdirSync(gitDir, { recursive: true });
  execFileSync('git', ['init'], { cwd: gitDir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.name', 'Workshop Test'], { cwd: gitDir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'workshop@example.com'], { cwd: gitDir, stdio: 'ignore' });
  writeFileSync(path.join(gitDir, 'README.md'), '# test\n');
  execFileSync('git', ['add', 'README.md'], { cwd: gitDir, stdio: 'ignore' });

  const gitAdapter = new GitAdapter({ cwd: gitDir });
  const branch = gitAdapter.currentBranch();
  assert.ok(branch.length > 0);
  const status = gitAdapter.status();
  assert.ok(status.includes('README.md'));

  const commitHash = gitAdapter.createCommit('test: seed workshop repo');
  assert.ok(commitHash.length > 0);

  const contextBuilder = new CouncilContextBuilder();
  const context = contextBuilder.build({
    sessionId: 'session-a',
    developmentRecord: {
      sessionId: 'session-a',
      timestamp: '2026-07-29T00:00:00.000Z',
      summary: 'Add workshop memory foundation',
      futureImpact: 'Future sessions will have structured memory',
      validation: { build: true, lint: true, tests: true },
      changes: { filesChanged: ['README.md'], insertions: 1, deletions: 0 },
      evidence: { errors: 0, warnings: 0, patterns: 1, health: { stability: 0.95 } },
    },
    evidenceSnapshot: {
      eventCount: 2,
      errorCount: 0,
      warningCount: 0,
      performanceSummary: { memorySpikes: 0, cpuSpikes: 0, apiDurationsMs: [20, 40] },
      modifiedFiles: ['README.md'],
    },
    commitContext: { commitMessage: 'test: seed workshop repo', status: 'ready' },
    changedFiles: ['README.md'],
    validationResults: { build: true, lint: true, tests: true },
    artifacts: ['development-record.json', 'commit-context.json', 'council-context.json'],
    git: { branch, latestCommit: commitHash },
    affectedModules: ['workshop/memory'],
    timeline: ['session started', 'artifact written'],
  });

  assert.equal(context.sessionId, 'session-a');
  assert.ok(context.artifacts?.includes('council-context.json'));

  const writer = new MemoryArtifactWriter(sessionDir);
  const written = writer.write(context, {
    developmentRecord: { sessionId: 'session-a' },
    commitContext: { commitMessage: 'test: seed workshop repo' },
    councilContext: context,
  });

  assert.ok(existsSync(written.developmentRecordPath));
  assert.ok(existsSync(written.commitContextPath));
  assert.ok(existsSync(written.councilContextPath));

  console.log('Council context flow OK');
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
