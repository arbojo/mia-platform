import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface MemoryArtifactWriterResult {
  developmentRecordPath: string;
  commitContextPath: string;
  councilContextPath: string;
}

export class MemoryArtifactWriter {
  constructor(private readonly sessionDir: string) {}

  public write(context: Record<string, unknown>, payload: Record<string, unknown>): MemoryArtifactWriterResult {
    mkdirSync(this.sessionDir, { recursive: true });

    const developmentRecordPath = path.join(this.sessionDir, 'development-record.json');
    const commitContextPath = path.join(this.sessionDir, 'commit-context.json');
    const councilContextPath = path.join(this.sessionDir, 'council-context.json');

    writeFileSync(developmentRecordPath, JSON.stringify(payload.developmentRecord ?? {}, null, 2));
    writeFileSync(commitContextPath, JSON.stringify(payload.commitContext ?? {}, null, 2));
    writeFileSync(councilContextPath, JSON.stringify(payload.councilContext ?? context, null, 2));

    return { developmentRecordPath, commitContextPath, councilContextPath };
  }
}
