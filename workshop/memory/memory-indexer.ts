import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export type MemoryEntryType = 'decision' | 'incident' | 'pattern' | 'lesson';
export type MemoryEntrySource = 'adr' | 'council' | 'observer' | 'manual';
export type MemoryEntryStatus = 'active' | 'archived' | 'superseded';

export interface MemoryEntry {
  id: string;
  type: MemoryEntryType;
  title: string;
  body: string;
  source: MemoryEntrySource;
  sourceRef: string;
  timestamp: string;
  tags: string[];
  references: string[];
  status: MemoryEntryStatus;
}

export interface MemoryIndex {
  version: string;
  lastScan: string | null;
  totalEntries: {
    decisions: number;
    incidents: number;
    patterns: number;
    lessons: number;
  };
  entries: MemoryEntry[];
}

const DEFAULT_INDEX_PATH = path.join(process.cwd(), '.mia-memory', 'index.json');
const ADR_DIR = path.join(process.cwd(), 'docs', 'adr');
const COUNCIL_REPORTS_DIR = path.join(process.cwd(), 'workshop', 'council', 'reports');

export class MemoryIndexer {
  private readonly indexPath: string;
  private readonly adrDir: string;
  private readonly councilReportsDir: string;

  constructor(options?: {
    indexPath?: string;
    adrDir?: string;
    councilReportsDir?: string;
  }) {
    this.indexPath = options?.indexPath ?? DEFAULT_INDEX_PATH;
    this.adrDir = options?.adrDir ?? ADR_DIR;
    this.councilReportsDir = options?.councilReportsDir ?? COUNCIL_REPORTS_DIR;
  }

  public indexAll(): MemoryIndex {
    const index = this.loadIndex();
    const before = index.entries.length;

    this.indexAdrs(index);
    this.indexCouncilReports(index);

    index.lastScan = new Date().toISOString();
    index.totalEntries = {
      decisions: index.entries.filter((e) => e.type === 'decision').length,
      incidents: index.entries.filter((e) => e.type === 'incident').length,
      patterns: index.entries.filter((e) => e.type === 'pattern').length,
      lessons: index.entries.filter((e) => e.type === 'lesson').length,
    };

    this.writeIndex(index);

    const added = index.entries.length - before;
    console.log(`Memory indexed: ${added} new entries (${index.entries.length} total)`);

    return index;
  }

  public query( filters: {
    type?: MemoryEntryType;
    source?: MemoryEntrySource;
    status?: MemoryEntryStatus;
    tag?: string;
    search?: string;
  }): MemoryEntry[] {
    const index = this.loadIndex();
    let entries = index.entries;

    if (filters.type) entries = entries.filter((e) => e.type === filters.type);
    if (filters.source) entries = entries.filter((e) => e.source === filters.source);
    if (filters.status) entries = entries.filter((e) => e.status === filters.status);
    if (filters.tag) entries = entries.filter((e) => e.tags.includes(filters.tag!));
    if (filters.search) {
      const q = filters.search.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.body.toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    return entries;
  }

  private indexAdrs(index: MemoryIndex): void {
    if (!existsSync(this.adrDir)) return;

    const files = readdirSync(this.adrDir)
      .filter((f) => f.endsWith('.md'))
      .sort();

    for (const file of files) {
      const existing = index.entries.find((e) => e.sourceRef === path.join(this.adrDir, file));
      if (existing) continue;

      const content = readFileSync(path.join(this.adrDir, file), 'utf8');
      const title = this.extractAdrTitle(file, content);
      const status = this.extractAdrStatus(content);
      const decision = this.extractAdrDecision(content);
      const adrNumber = file.match(/^(\d+)/)?.[1] ?? '000';

      index.entries.push({
        id: `adr-${adrNumber}`,
        type: 'decision',
        title: `ADR-${adrNumber}: ${title}`,
        body: decision.slice(0, 500),
        source: 'adr',
        sourceRef: path.join(this.adrDir, file),
        timestamp: new Date().toISOString(),
        tags: ['adr', status.toLowerCase(), 'decision'],
        references: [],
        status: status === 'Accepted' ? 'active' : 'archived',
      });
    }
  }

  private indexCouncilReports(index: MemoryIndex): void {
    if (!existsSync(this.councilReportsDir)) return;

    const files = readdirSync(this.councilReportsDir)
      .filter((f) => f.startsWith('audit-') && f.endsWith('.json') && !f.includes('-evidence'))
      .sort();

    for (const file of files) {
      const existing = index.entries.find((e) => e.sourceRef === path.join(this.councilReportsDir, file));
      if (existing) continue;

      try {
        const content = JSON.parse(readFileSync(path.join(this.councilReportsDir, file), 'utf8'));
        const report = content as { sessionId: string; findings: Array<{ severity: string; title: string; description: string }>; timestamp: string };

        const criticalFindings = report.findings.filter((f) => f.severity === 'critical' || f.severity === 'high');
        const mediumFindings = report.findings.filter((f) => f.severity === 'medium');

        for (const finding of criticalFindings) {
          index.entries.push({
            id: `incident-${report.sessionId}-${finding.title.slice(0, 20).replace(/\s+/g, '-')}`,
            type: 'incident',
            title: finding.title,
            body: finding.description.slice(0, 300),
            source: 'council',
            sourceRef: path.join(this.councilReportsDir, file),
            timestamp: report.timestamp,
            tags: ['council', finding.severity, 'finding'],
            references: [],
            status: 'active',
          });
        }

        if (mediumFindings.length > 0) {
          index.entries.push({
            id: `pattern-council-${report.sessionId}`,
            type: 'pattern',
            title: `Council audit found ${mediumFindings.length} medium-severity items`,
            body: mediumFindings.map((f) => `${f.severity}: ${f.title}`).join('\n'),
            source: 'council',
            sourceRef: path.join(this.councilReportsDir, file),
            timestamp: report.timestamp,
            tags: ['council', 'pattern', 'review'],
            references: criticalFindings.map((f) => f.title),
            status: 'active',
          });
        }
      } catch {
        // Skip unparseable reports
      }
    }
  }

  private extractAdrTitle(fileName: string, content: string): string {
    const match = content.match(/^#\s+.+:\s+(.+)$/m);
    return match?.[1]?.trim() ?? fileName.replace('.md', '');
  }

  private extractAdrStatus(content: string): string {
    const match = content.match(/^##\s*Status\s*\r?\n\r?\n(.+)/m);
    return match?.[1]?.trim() ?? 'Unknown';
  }

  private extractAdrDecision(content: string): string {
    const match = content.match(/^##\s*(?:3\.)?\s*Decision\s*\n([\s\S]+?)(?=\n##\s)/m);
    return match?.[1]?.trim() ?? '';
  }

  private loadIndex(): MemoryIndex {
    if (!existsSync(this.indexPath)) {
      return {
        version: '2.0',
        lastScan: null,
        totalEntries: { decisions: 0, incidents: 0, patterns: 0, lessons: 0 },
        entries: [],
      };
    }

    try {
      return JSON.parse(readFileSync(this.indexPath, 'utf8')) as MemoryIndex;
    } catch {
      return {
        version: '2.0',
        lastScan: null,
        totalEntries: { decisions: 0, incidents: 0, patterns: 0, lessons: 0 },
        entries: [],
      };
    }
  }

  private writeIndex(index: MemoryIndex): void {
    const dir = path.dirname(this.indexPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.indexPath, JSON.stringify(index, null, 2));
  }
}
