import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { CouncilAuditReport } from '../types';

export interface PersistedReport {
  report: CouncilAuditReport;
  evidenceLogPath: string;
  markdownPath: string;
  jsonPath: string;
}

export class ReportPersister {
  private readonly outputDir: string;

  constructor(outputDir?: string) {
    this.outputDir = outputDir ?? path.join(process.cwd(), 'workshop', 'council', 'reports');
    mkdirSync(this.outputDir, { recursive: true });
  }

  public persist(
    report: CouncilAuditReport,
    evidenceLog?: Array<{
      findingId: string;
      previousState: string;
      newState: string;
      reason: string;
      filePath?: string;
      headCommit: string;
    }>,
  ): PersistedReport {
    const fileName = `audit-${report.sessionId}`;
    const jsonPath = path.join(this.outputDir, `${fileName}.json`);
    const markdownPath = path.join(this.outputDir, `${fileName}.md`);
    const evidenceLogPath = path.join(this.outputDir, `${fileName}-evidence.json`);

    writeFileSync(jsonPath, JSON.stringify(report, null, 2));

    if (evidenceLog) {
      writeFileSync(evidenceLogPath, JSON.stringify(evidenceLog, null, 2));
    }

    const markdown = this.toMarkdown(report, evidenceLog);
    writeFileSync(markdownPath, markdown);

    return { report, evidenceLogPath, markdownPath, jsonPath };
  }

  public loadLatest(): CouncilAuditReport | null {
    if (!existsSync(this.outputDir)) return null;

    try {
      const files = readdirSync(this.outputDir)
        .filter((f) => f.startsWith('audit-') && f.endsWith('.json') && !f.includes('-evidence'))
        .sort()
        .reverse();

      if (files.length === 0) return null;

      const content = readFileSync(path.join(this.outputDir, files[0]), 'utf8');
      return JSON.parse(content) as CouncilAuditReport;
    } catch {
      return null;
    }
  }

  public loadAll(): CouncilAuditReport[] {
    if (!existsSync(this.outputDir)) return [];

    try {
      const files = readdirSync(this.outputDir)
        .filter((f) => f.startsWith('audit-') && f.endsWith('.json') && !f.includes('-evidence'))
        .sort();

      return files.map((f) => {
        const content = readFileSync(path.join(this.outputDir, f), 'utf8');
        return JSON.parse(content) as CouncilAuditReport;
      });
    } catch {
      return [];
    }
  }

  private toMarkdown(
    report: CouncilAuditReport,
    evidenceLog?: Array<{
      findingId: string;
      previousState: string;
      newState: string;
      reason: string;
      filePath?: string;
      headCommit: string;
    }>,
  ): string {
    const lines: string[] = [
      `# Council Audit — ${report.sessionId}`,
      '',
      `**Date**: ${report.timestamp}`,
      `**Status**: ${report.status}`,
    ];

    if (report.performanceMs !== undefined) {
      lines.push(`**Performance**: ${report.performanceMs}ms`);
    }
    if (report.rolesFailed) {
      lines.push(`**Roles Failed**: ${report.rolesFailed.join(', ')}`);
    }

    lines.push(
      '',
      '## Roles Executed',
      '',
      ...report.rolesExecuted.map((r) => `- ${r}`),
      '',
      `## Findings (${report.findings.length})`,
      '',
    );

    for (const finding of report.findings) {
      lines.push(`### ${finding.id} — [${finding.severity}] ${finding.title}`);
      lines.push('');
      lines.push(`**Role**: ${finding.role}`);
      lines.push(`**Category**: ${finding.category}`);
      lines.push(`**Affected Area**: ${finding.affectedArea}`);
      lines.push(`**Description**: ${finding.description}`);
      if (finding.filePath) lines.push(`**File**: ${finding.filePath}`);
      if (finding.state) lines.push(`**State**: ${finding.state}`);
      lines.push('');
      lines.push('**Evidence**:');
      for (const ev of finding.evidence) {
        lines.push(`- ${ev}`);
      }
      if (finding.recommendation) {
        lines.push('');
        lines.push(`**Recommendation**: ${finding.recommendation}`);
      }
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    if (evidenceLog && evidenceLog.length > 0) {
      lines.push('## Evidence Log (Evidence First Protocol)');
      lines.push('');
      lines.push('| Finding | Previous State | New State | Reason |');
      lines.push('|---------|---------------|-----------|--------|');
      for (const entry of evidenceLog) {
        lines.push(`| ${entry.findingId} | ${entry.previousState} | ${entry.newState} | ${entry.reason} |`);
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');

    const criticalCount = report.findings.filter((f) => f.severity === 'critical').length;
    const highCount = report.findings.filter((f) => f.severity === 'high').length;
    const mediumCount = report.findings.filter((f) => f.severity === 'medium').length;
    const lowCount = report.findings.filter((f) => f.severity === 'low').length;

    lines.push('## Summary');
    lines.push('');
    lines.push(`- **Critical**: ${criticalCount}`);
    lines.push(`- **High**: ${highCount}`);
    lines.push(`- **Medium**: ${mediumCount}`);
    lines.push(`- **Low**: ${lowCount}`);
    lines.push(`- **Total**: ${report.findings.length}`);

    return lines.join('\n');
  }
}
