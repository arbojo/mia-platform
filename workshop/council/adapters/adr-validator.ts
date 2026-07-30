import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

export interface AdrEntry {
  fileName: string;
  adrNumber: number;
  title: string;
  status: string;
  date: string;
  decision: string;
  context: string;
  fullPath: string;
}

export interface AdrValidationContext {
  adrs: AdrEntry[];
  acceptedAdrs: AdrEntry[];
  totalCount: number;
  acceptedCount: number;
  proposedCount: number;
}

export class AdrValidator {
  private readonly adrDir: string;

  constructor(adrDir?: string) {
    this.adrDir = adrDir ?? path.join(process.cwd(), 'docs', 'adr');
  }

  public loadAll(): AdrValidationContext {
    if (!existsSync(this.adrDir)) {
      return { adrs: [], acceptedAdrs: [], totalCount: 0, acceptedCount: 0, proposedCount: 0 };
    }

    const files = readdirSync(this.adrDir)
      .filter((f) => f.endsWith('.md'))
      .sort();

    const adrs: AdrEntry[] = [];

    for (const file of files) {
      const fullPath = path.join(this.adrDir, file);
      const content = readFileSync(fullPath, 'utf8');
      const parsed = this.parseAdr(file, content, fullPath);
      if (parsed) adrs.push(parsed);
    }

    const acceptedAdrs = adrs.filter((a) => a.status === 'Accepted');
    const proposedCount = adrs.filter((a) => a.status === 'Proposed').length;

    return {
      adrs,
      acceptedAdrs,
      totalCount: adrs.length,
      acceptedCount: acceptedAdrs.length,
      proposedCount,
    };
  }

  public getDecisionsSummary(): string {
    const ctx = this.loadAll();
    if (ctx.totalCount === 0) return 'No ADRs found';

    const lines: string[] = [
      `# ADR Summary (${ctx.totalCount} total, ${ctx.acceptedCount} accepted, ${ctx.proposedCount} proposed)`,
      '',
    ];

    for (const adr of ctx.adrs) {
      lines.push(`## ADR-${String(adr.adrNumber).padStart(3, '0')}: ${adr.title}`);
      lines.push(`- **Status**: ${adr.status}`);
      lines.push(`- **Date**: ${adr.date}`);
      lines.push(`- **Context**: ${adr.context}`);
      lines.push(`- **Decision**: ${adr.decision}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  private parseAdr(fileName: string, content: string, fullPath: string): AdrEntry | null {
    const numberMatch = fileName.match(/^(\d+)/);
    if (!numberMatch) return null;

    const adrNumber = parseInt(numberMatch[1], 10);
    const titleMatch = content.match(/^#\s+.+:\s+(.+)$/m);
    const statusMatch = content.match(/^##\s*Status\s*\r?\n\r?\n(.+)/m);
    const dateMatch = content.match(/^##\s*Date\s*\r?\n\r?\n(\S+)/m);
    const contextMatch = content.match(/^##\s*Context\s*\r?\n\r?\n([\s\S]+?)(?=\r?\n##\s)/m);
    const decisionMatch = content.match(/^##\s*Decision\s*\n([\s\S]+?)(?=\n##\s)/m);

    return {
      fileName,
      adrNumber,
      title: titleMatch?.[1]?.trim() ?? fileName,
      status: statusMatch?.[1]?.trim() ?? 'Unknown',
      date: dateMatch?.[1]?.trim() ?? 'Unknown',
      context: contextMatch?.[1]?.trim().slice(0, 200) ?? '',
      decision: decisionMatch?.[1]?.trim().slice(0, 200) ?? '',
      fullPath,
    };
  }
}
