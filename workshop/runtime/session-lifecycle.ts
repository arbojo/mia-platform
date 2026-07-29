import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { DevelopmentSession, WorkshopEventMetadata } from '../types';
import { createDefaultWorkshopConfig } from '../config';

export interface SessionLifecycleOptions {
  baseDir?: string;
  sessionTimeoutMs?: number;
  metadata?: WorkshopEventMetadata;
}

export class SessionLifecycle {
  private readonly config = createDefaultWorkshopConfig();
  private readonly baseDir: string;
  private readonly sessionTimeoutMs: number;
  private readonly metadata: WorkshopEventMetadata;
  private session: DevelopmentSession | null = null;

  constructor(options: SessionLifecycleOptions = {}) {
    this.baseDir = options.baseDir ?? this.config.baseDir;
    this.sessionTimeoutMs = options.sessionTimeoutMs ?? this.config.sessionTimeoutMs;
    this.metadata = options.metadata ?? {};
  }

  public start(): DevelopmentSession {
    if (this.session?.status === 'active') {
      return this.session;
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const sessionDir = path.join(this.baseDir, id);
    mkdirSync(sessionDir, { recursive: true });

    this.session = {
      id,
      startedAt: now,
      status: 'active',
      metadata: this.metadata,
      sessionDir,
    };

    return this.session;
  }

  public end(status: DevelopmentSession['status'] = 'ended', metadata: WorkshopEventMetadata = {}): DevelopmentSession {
    if (!this.session) {
      throw new Error('No active session to end.');
    }

    this.session.endedAt = new Date().toISOString();
    this.session.status = status;
    this.session.metadata = { ...this.session.metadata, ...metadata };

    this.writeSessionState();
    return this.session;
  }

  public getSession(): DevelopmentSession | null {
    return this.session;
  }

  public getSessionDir(): string {
    if (!this.session?.sessionDir) {
      throw new Error('Session has not been started.');
    }
    return this.session.sessionDir;
  }

  public getSessionTimeoutMs(): number {
    return this.sessionTimeoutMs;
  }

  private writeSessionState(): void {
    if (!this.session) {
      return;
    }

    const sessionStatePath = path.join(this.session.sessionDir, 'session.json');
    writeFileSync(sessionStatePath, JSON.stringify(this.session, null, 2));
  }
}
