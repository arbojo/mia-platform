import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { CouncilContext } from '../types';

export interface GitContextAdapterOptions {
  repoPath?: string;
  summary?: string;
  futureImpact?: string;
}

export class GitContextAdapter {
  private readonly repoPath: string;

  constructor(options: GitContextAdapterOptions = {}) {
    this.repoPath = options.repoPath ?? process.cwd();
  }

  public async buildContext(options?: GitContextAdapterOptions): Promise<CouncilContext> {
    const headCommit = this.getHeadCommit();
    const branch = this.getBranch();
    const changedFiles = this.getChangedFiles();
    const diffStat = this.getDiffStat();
    const lastCommitMessage = this.getLastCommitMessage();
    const sessionId = `council-${headCommit}-${Date.now()}`;

    const validation = await this.runValidation();

    const context: CouncilContext = {
      sessionId,
      developmentRecord: {
        sessionId,
        timestamp: new Date().toISOString(),
        summary: options?.summary ?? lastCommitMessage,
        futureImpact: options?.futureImpact ?? 'Pending Council review',
        validation: {
          build: validation.build,
          lint: validation.lint,
          tests: validation.tests,
        },
        changes: {
          filesChanged: changedFiles,
          insertions: diffStat.insertions,
          deletions: diffStat.deletions,
        },
        evidence: {
          errors: validation.build ? 0 : 1,
          warnings: 0,
          patterns: changedFiles.length,
          health: {
            stability: validation.build ? 0.9 : 0.5,
            coverage: validation.tests ? 0.8 : 0.4,
            traceability: 0.85,
          },
        },
      },
      evidenceSnapshot: {
        eventCount: changedFiles.length,
        errorCount: validation.build ? 0 : 1,
        warningCount: 0,
        performanceSummary: {
          memorySpikes: 0,
          cpuSpikes: 0,
          apiDurationsMs: [],
        },
        modifiedFiles: changedFiles,
      },
      commitContext: {
        commitMessage: lastCommitMessage,
        branch,
        headCommit,
        status: 'ready',
      },
      changedFiles,
      validationResults: {
        build: validation.build,
        lint: validation.lint,
        tests: validation.tests,
      },
      git: {
        headCommit,
        branch,
        repoPath: this.repoPath,
      },
    };

    return context;
  }

  private getHeadCommit(): string {
    try {
      return execSync('git rev-parse --short HEAD', { cwd: this.repoPath, encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  private getBranch(): string {
    try {
      return execSync('git branch --show-current', { cwd: this.repoPath, encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  private getChangedFiles(): string[] {
    try {
      const output = execSync('git diff HEAD~1 --name-only', { cwd: this.repoPath, encoding: 'utf8' }).trim();
      if (!output) return [];
      return output.split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  private getDiffStat(): { insertions: number; deletions: number } {
    try {
      const output = execSync('git diff HEAD~1 --shortstat', { cwd: this.repoPath, encoding: 'utf8' }).trim();
      const insertions = output.match(/(\d+) insertion/) ?? ['', '0'];
      const deletions = output.match(/(\d+) deletion/) ?? ['', '0'];
      return {
        insertions: parseInt(insertions[1], 10) || 0,
        deletions: parseInt(deletions[1], 10) || 0,
      };
    } catch {
      return { insertions: 0, deletions: 0 };
    }
  }

  private getLastCommitMessage(): string {
    try {
      return execSync('git log --oneline -1', { cwd: this.repoPath, encoding: 'utf8' }).trim();
    } catch {
      return 'No commits yet';
    }
  }

  private async runValidation(): Promise<{ build: boolean; lint: boolean; tests: boolean }> {
    const result = { build: false, lint: false, tests: false };

    const rootDir = this.findProjectRoot();
    if (!rootDir) return result;

    try {
      execSync('npx next build', { cwd: rootDir, encoding: 'utf8', timeout: 120000, stdio: 'pipe' });
      result.build = true;
    } catch {
      result.build = false;
    }

    try {
      execSync('npx eslint . --quiet', { cwd: rootDir, encoding: 'utf8', timeout: 60000, stdio: 'pipe' });
      result.lint = true;
    } catch {
      result.lint = false;
    }

    try {
      execSync('npx vitest run --reporter=verbose', { cwd: rootDir, encoding: 'utf8', timeout: 120000, stdio: 'pipe' });
      result.tests = true;
    } catch {
      result.tests = false;
    }

    return result;
  }

  private findProjectRoot(): string | null {
    let dir = this.repoPath;
    while (dir.length > 0) {
      if (existsSync(path.join(dir, 'package.json'))) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }
    return null;
  }
}
