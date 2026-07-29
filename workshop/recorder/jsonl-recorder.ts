import { appendFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import type { WorkshopEvent } from '../types';

export interface JsonlRecorderOptions {
  directory: string;
  fileName?: string;
}

export class JsonlRecorder {
  private readonly directory: string;
  private readonly fileName: string;

  constructor(options: JsonlRecorderOptions) {
    this.directory = options.directory;
    this.fileName = options.fileName ?? 'events.jsonl';
    mkdirSync(this.directory, { recursive: true });
  }

  public append(event: WorkshopEvent): void {
    const line = `${JSON.stringify(event)}\n`;
    appendFileSync(path.join(this.directory, this.fileName), line, 'utf8');
  }

  public appendMany(events: WorkshopEvent[]): void {
    for (const event of events) {
      this.append(event);
    }
  }
}
