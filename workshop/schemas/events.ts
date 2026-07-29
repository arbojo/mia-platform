import { z } from 'zod';

export const workshopEventMetadataSchema = z.record(z.string(), z.unknown()).default({});

export const workshopEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  sessionId: z.string(),
  source: z.string(),
  category: z.string(),
  severity: z.enum(['debug', 'info', 'warning', 'error', 'critical']),
  action: z.string(),
  module: z.string(),
  page: z.string().optional(),
  component: z.string().optional(),
  metadata: workshopEventMetadataSchema,
  duration: z.number().optional(),
});

export const workshopSessionSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  status: z.enum(['active', 'ended', 'stopped', 'inactive']),
  metadata: workshopEventMetadataSchema,
  sessionDir: z.string(),
});

export const workshopSessionReportSchema = z.object({
  sessionId: z.string(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  durationMs: z.number().optional(),
  general: z.object({
    eventCount: z.number(),
    categories: z.record(z.string(), z.number()),
    severities: z.record(z.string(), z.number()),
    warnings: z.number(),
    errors: z.number(),
  }),
  visitedPages: z.array(z.string()),
  buildSummary: z.object({
    started: z.number(),
    finished: z.number(),
    failed: z.number(),
    durationsMs: z.array(z.number()),
  }),
  testSummary: z.object({
    started: z.number(),
    finished: z.number(),
    failed: z.number(),
    coverage: z.array(z.number()),
  }),
  performanceSummary: z.object({
    memorySpikes: z.number(),
    cpuSpikes: z.number(),
    apiDurationsMs: z.array(z.number()),
  }),
  errorSummary: z.object({
    runtimeFailures: z.number(),
    deadInteractions: z.number(),
    consoleErrors: z.number(),
  }),
  deadInteractions: z.array(workshopEventSchema),
  runtimeFailures: z.array(workshopEventSchema),
  modifiedFiles: z.array(z.string()),
  gitInfo: z.object({
    branch: z.string().optional(),
    latestCommit: z.string().optional(),
  }),
  statistics: z.object({
    uniqueModules: z.array(z.string()),
    mostCommonActions: z.array(z.object({ action: z.string(), count: z.number() })),
  }),
  timeline: z.array(workshopEventSchema),
});
