import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import type { WorkshopEvent, WorkshopSessionReport } from '../types';

export interface SessionReportGeneratorOptions {
  sessionDir: string;
  eventFilePath: string;
  outputFileName?: string;
}

export class SessionReportGenerator {
  constructor(private readonly options: SessionReportGeneratorOptions) {}

  public generate(events: WorkshopEvent[]): WorkshopSessionReport {
    const report: WorkshopSessionReport = {
      sessionId: events[0]?.sessionId ?? 'unknown',
      startedAt: events[0]?.timestamp ?? new Date().toISOString(),
      endedAt: events.at(-1)?.timestamp,
      durationMs: this.computeDuration(events),
      general: {
        eventCount: events.length,
        categories: this.countBy(events, 'category'),
        severities: this.countBy(events, 'severity'),
        warnings: events.filter((event) => event.severity === 'warning').length,
        errors: events.filter((event) => event.severity === 'error' || event.severity === 'critical').length,
      },
      visitedPages: this.unique(events.map((event) => event.page).filter(Boolean) as string[]),
      buildSummary: {
        started: events.filter((event) => event.action === 'build started').length,
        finished: events.filter((event) => event.action === 'build finished').length,
        failed: events.filter((event) => event.action === 'build failed').length,
        durationsMs: events.filter((event) => typeof event.duration === 'number').map((event) => event.duration as number),
      },
      testSummary: {
        started: events.filter((event) => event.action === 'tests started').length,
        finished: events.filter((event) => event.action === 'tests finished').length,
        failed: events.filter((event) => event.action === 'tests failed').length,
        coverage: events.filter((event) => typeof event.metadata.coverage === 'number').map((event) => event.metadata.coverage as number),
      },
      performanceSummary: {
        memorySpikes: events.filter((event) => event.action === 'memory spike').length,
        cpuSpikes: events.filter((event) => event.action === 'cpu spike').length,
        apiDurationsMs: events.filter((event) => event.category === 'API' && typeof event.duration === 'number').map((event) => event.duration as number),
      },
      errorSummary: {
        runtimeFailures: events.filter((event) => event.action === 'runtime failure').length,
        deadInteractions: events.filter((event) => event.action === 'dead interaction').length,
        consoleErrors: events.filter((event) => event.action === 'console error').length,
      },
      deadInteractions: events.filter((event) => event.action === 'dead interaction'),
      runtimeFailures: events.filter((event) => event.action === 'runtime failure'),
      modifiedFiles: this.readModifiedFiles(),
      gitInfo: {
        branch: this.readGitBranch(),
        latestCommit: this.readLatestCommit(),
      },
      statistics: {
        uniqueModules: this.unique(events.map((event) => event.module)),
        mostCommonActions: this.mostCommon(events.map((event) => event.action)),
      },
      timeline: events,
    };

    this.write(report);
    return report;
  }

  private write(report: WorkshopSessionReport): void {
    mkdirSync(this.options.sessionDir, { recursive: true });
    const outputPath = path.join(this.options.sessionDir, this.options.outputFileName ?? 'session-report.json');
    writeFileSync(outputPath, JSON.stringify(report, null, 2));
  }

  private readModifiedFiles(): string[] {
    const gitStatusPath = path.join(this.options.sessionDir, 'git-status.txt');
    if (!existsSync(gitStatusPath)) {
      return [];
    }

    return readFileSync(gitStatusPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  private readGitBranch(): string | undefined {
    return undefined;
  }

  private readLatestCommit(): string | undefined {
    return undefined;
  }

  private computeDuration(events: WorkshopEvent[]): number | undefined {
    if (events.length === 0) {
      return undefined;
    }

    const first = new Date(events[0].timestamp).getTime();
    const last = new Date(events.at(-1)?.timestamp ?? events[0].timestamp).getTime();
    return Math.max(0, last - first);
  }

  private countBy(events: WorkshopEvent[], field: 'category' | 'severity'): Record<string, number> {
    return events.reduce<Record<string, number>>((acc, event) => {
      const key = event[field];
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }

  private unique(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))];
  }

  private mostCommon(values: string[]): Array<{ action: string; count: number }> {
    const counts = values.reduce<Record<string, number>>((acc, value) => {
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }));
  }
}
