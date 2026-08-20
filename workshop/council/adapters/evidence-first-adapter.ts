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

const FILE_LINE_RE = /^(.+):(\d+)$/;

export function parseFileLine(reference: string): { filePath: string; line: number } | null {
  const match = reference.match(FILE_LINE_RE);
  if (!match) return null;
  return { filePath: match[1], line: parseInt(match[2], 10) };
}

export function validateFileLineReference(reference: string): { valid: boolean; error?: string } {
  const parsed = parseFileLine(reference);
  if (!parsed) {
    return { valid: false, error: `Invalid file:line format: "${reference}" — expected "path/to/file.ts:42"` };
  }
  if (parsed.line < 1) {
    return { valid: false, error: `Line number must be >= 1, got ${parsed.line}` };
  }
  return { valid: true };
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

    // Validate file:line format if line number is present
    const parsed = parseFileLine(filePath);
    const actualFilePath = parsed ? parsed.filePath : filePath;

    if (parsed && parsed.line < 1) {
      return {
        updated: { ...finding, state: 'invalidated', headCommit: currentHead },
        log: {
          findingId: finding.id,
          previousState,
          newState: 'invalidated',
          reason: `Invalid line number: ${parsed.line} in "${filePath}"`,
          filePath,
          headCommit: currentHead,
        },
      };
    }

    const fullPath = path.join(this.repoPath, actualFilePath);

    if (!existsSync(fullPath)) {
      return {
        updated: { ...finding, state: 'superseded', headCommit: currentHead },
        log: {
          findingId: finding.id,
          previousState,
          newState: 'superseded',
          reason: `File deleted: ${actualFilePath}`,
          filePath,
          headCommit: currentHead,
        },
      };
    }

    // If file:line format, verify the line exists in the file
    if (parsed) {
      try {
        const content = readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');
        if (parsed.line > lines.length) {
          return {
            updated: { ...finding, state: 'invalidated', headCommit: currentHead },
            log: {
              findingId: finding.id,
              previousState,
              newState: 'invalidated',
              reason: `Line ${parsed.line} does not exist in ${actualFilePath} (${lines.length} lines)`,
              filePath,
              headCommit: currentHead,
            },
          };
        }
      } catch {
        // If we can't read the file, fall through to git diff check
      }
    }

    const fileChanged = this.fileChangedSince(actualFilePath, finding.headCommit ?? 'HEAD~1');

    if (fileChanged) {
      return {
        updated: { ...finding, state: 'resolved', headCommit: currentHead },
        log: {
          findingId: finding.id,
          previousState,
          newState: 'resolved',
          reason: `File modified since last audit: ${actualFilePath}`,
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
