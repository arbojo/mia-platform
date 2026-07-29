import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';

export interface WorkshopConfig {
  baseDir: string;
  sessionTimeoutMs: number;
  dedupeWindowMs: number;
  eventFileName: string;
  sessionReportFileName: string;
  reportFormat: 'json';
}

export function createDefaultWorkshopConfig(overrides: Partial<WorkshopConfig> = {}): WorkshopConfig {
  return {
    baseDir: path.resolve(process.cwd(), 'workshop-data'),
    sessionTimeoutMs: 15 * 60 * 1000,
    dedupeWindowMs: 2_000,
    eventFileName: 'events.jsonl',
    sessionReportFileName: 'session-report.json',
    reportFormat: 'json',
    ...overrides,
  };
}

export function loadWorkshopConfig(configPath?: string): WorkshopConfig {
  const defaults = createDefaultWorkshopConfig();

  if (!configPath) {
    return defaults;
  }

  if (!existsSync(configPath)) {
    return defaults;
  }

  const raw = JSON.parse(readFileSync(configPath, 'utf8')) as Partial<WorkshopConfig>;
  return createDefaultWorkshopConfig({ ...defaults, ...raw });
}

export function resolveWorkshopConfig(overrides: Partial<WorkshopConfig> = {}): WorkshopConfig {
  return createDefaultWorkshopConfig({
    ...createDefaultWorkshopConfig(),
    ...overrides,
  });
}
