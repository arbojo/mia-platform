import { execFileSync } from 'node:child_process';

export interface GitAdapterOptions {
  cwd?: string;
}

export class GitAdapter {
  constructor(private readonly options: GitAdapterOptions = {}) {}

  public currentBranch(): string {
    try {
      return execFileSync('git', ['branch', '--show-current'], { cwd: this.options.cwd, encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  public status(): string {
    try {
      return execFileSync('git', ['status', '--short'], { cwd: this.options.cwd, encoding: 'utf8' }).trim();
    } catch {
      return '';
    }
  }

  public diff(): string {
    try {
      return execFileSync('git', ['diff', '--stat'], { cwd: this.options.cwd, encoding: 'utf8' }).trim();
    } catch {
      return '';
    }
  }

  public recentCommits(limit = 5): string[] {
    try {
      const output = execFileSync('git', ['log', '--oneline', `-${limit}`], { cwd: this.options.cwd, encoding: 'utf8' });
      return output.split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  public createCommit(message: string): string {
    try {
      execFileSync('git', ['add', '-A'], { cwd: this.options.cwd, stdio: 'ignore' });
      execFileSync('git', ['commit', '-m', message], { cwd: this.options.cwd, stdio: 'ignore' });
      return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: this.options.cwd, encoding: 'utf8' }).trim();
    } catch {
      return '';
    }
  }
}
