import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { DevelopmentRecord } from './development-record';

export interface DevelopmentMemoryArtifact {
  developmentRecordPath: string;
  commitContextPath: string;
}

export class DevelopmentMemoryArtifactWriter {
  constructor(private readonly sessionDir: string) {}

  public write(record: DevelopmentRecord, commitContext: Record<string, unknown>): DevelopmentMemoryArtifact {
    mkdirSync(this.sessionDir, { recursive: true });

    const developmentRecordPath = path.join(this.sessionDir, 'development-record.json');
    const commitContextPath = path.join(this.sessionDir, 'commit-context.json');

    writeFileSync(developmentRecordPath, JSON.stringify(record, null, 2));
    writeFileSync(commitContextPath, JSON.stringify(commitContext, null, 2));

    return { developmentRecordPath, commitContextPath };
  }
}
