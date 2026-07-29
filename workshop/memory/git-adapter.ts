import { execSync } from 'node:child_process';

export interface GitStatus {
  branch: string;
  status: string;
  diff: string;
  lastCommit: string;
}

export class GitAdapter {
  public getStatus(): GitStatus {
    return {
      branch: this.run('git branch --show-current'),
      status: this.run('git status --short'),
      diff: this.run('git diff --stat'),
      lastCommit: this.run('git rev-parse --short HEAD'),
    };
  }

  public getDiff(): string {
    return this.run('git diff --stat');
  }

  public getBranch(): string {
    return this.run('git branch --show-current');
  }

  public getHistory(limit = 5): string[] {
    return this.run(`git log --oneline -n ${limit}`).split('\n').filter(Boolean);
  }

  public createCommit(message: string): string {
    this.run(`git add .`);
    this.run(`git commit -m "${message}"`);
    return this.run('git rev-parse --short HEAD');
  }

  private run(command: string): string {
    return execSync(command, { cwd: process.cwd(), encoding: 'utf8' }).trim();
  }
}
