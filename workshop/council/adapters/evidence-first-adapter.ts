import { execSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { CouncilFinding, CouncilFindingState } from '../types';

export interface EvidenceLogEntry {
  findingId: string;
  previousState: CouncilFindingState;
  newState: CouncilFindingState;
  reason: string;
  filePath?: string;
  headCommit: string;
}

export interface EvidenceFirstResult {
  currentFindings: CouncilFinding[];
  evidenceLog: EvidenceLogEntry[];
  headCommit: string;
  previousFindingsCount: number;
  revalidatedCount: number;
  changedStates: number;
}

export interface EvidenceFirstAdapterOptions {
  reportsDir?: string;
  repoPath?: string;
}

export class EvidenceFirstAdapter {
  private readonly reportsDir: string;
  private readonly repoPath: string;

  constructor(options: EvidenceFirstAdapterOptions = {}) {
    this.reportsDir = options.reportsDir ?? path.join(process.cwd(), 'workshop', 'council', 'reports');
    this.repoPath = options.repoPath ?? process.cwd();
  }

  public preAudit(newFindings: CouncilFinding[]): EvidenceFirstResult {
    const headCommit = this.getHeadCommit();
    const previousFindings = this.loadPreviousFindings();
    const evidenceLog: EvidenceLogEntry[] = [];
    const revalidatedFindings: CouncilFinding[] = [];

    for (const prev of previousFindings) {
      const result = this.revalidate(prev, headCommit);
      evidenceLog.push(result.log);

      if (result.updated.state === 'open') {
        revalidatedFindings.push(result.updated);
      }
    }

    const currentFindings = [
      ...revalidatedFindings,
      ...newFindings.map((f) => ({
        ...f,
        state: 'open' as CouncilFindingState,
        headCommit,
      })),
    ];

    return {
      currentFindings,
      evidenceLog,
      headCommit,
      previousFindingsCount: previousFindings.length,
      revalidatedCount: previousFindings.length,
      changedStates: evidenceLog.filter((e) => e.previousState !== e.newState).length,
    };
  }

  private revalidate(
    finding: CouncilFinding,
    currentHead: string,
  ): { updated: CouncilFinding; log: EvidenceLogEntry } {
    const previousState = (finding.state ?? 'open') as CouncilFindingState;
    const filePath = finding.filePath;

    if (!filePath) {
      return {
        updated: { ...finding, state: previousState, headCommit: currentHead },
        log: {
          findingId: finding.id,
          previousState,
          newState: previousState,
          reason: 'No file path to re-validate',
          headCommit: currentHead,
        },
      };
    }

    const fullPath = path.join(this.repoPath, filePath);

    if (!existsSync(fullPath)) {
      return {
        updated: { ...finding, state: 'superseded', headCommit: currentHead },
        log: {
          findingId: finding.id,
          previousState,
          newState: 'superseded',
          reason: `File deleted: ${filePath}`,
          filePath,
          headCommit: currentHead,
        },
      };
    }

    const fileChanged = this.fileChangedSince(filePath, finding.headCommit ?? 'HEAD~1');

    if (fileChanged) {
      return {
        updated: { ...finding, state: 'resolved', headCommit: currentHead },
        log: {
          findingId: finding.id,
          previousState,
          newState: 'resolved',
          reason: `File modified since last audit: ${filePath}`,
          filePath,
          headCommit: currentHead,
        },
      };
    }

    return {
      updated: { ...finding, state: 'open', headCommit: currentHead },
      log: {
        findingId: finding.id,
        previousState,
        newState: 'open',
        reason: `Finding still valid at ${filePath}`,
        filePath,
        headCommit: currentHead,
      },
    };
  }

  private fileChangedSince(filePath: string, sinceCommit: string): boolean {
    try {
      const output = execSync(
        `git diff ${sinceCommit} --name-only -- "${filePath}"`,
        { cwd: this.repoPath, encoding: 'utf8', stdio: 'pipe' },
      ).trim();
      return output.length > 0;
    } catch {
      return false;
    }
  }

  private loadPreviousFindings(): CouncilFinding[] {
    const reportDir = this.reportsDir;
    if (!existsSync(reportDir)) return [];

    try {
      const files = readdirSync(reportDir)
        .filter((f: string) => f.startsWith('audit-') && f.endsWith('.json'))
        .sort()
        .reverse();

      if (files.length === 0) return [];

      const latest = path.join(reportDir, files[0]);
      const content = JSON.parse(readFileSync(latest, 'utf8'));
      return content.findings ?? [];
    } catch {
      return [];
    }
  }

  private getHeadCommit(): string {
    try {
      return execSync('git rev-parse --short HEAD', { cwd: this.repoPath, encoding: 'utf8' }).trim();
    } catch {
      return 'unknown';
    }
  }
}
