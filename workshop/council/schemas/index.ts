import { z } from 'zod';

export const councilFindingSchema = z.object({
  id: z.string(),
  role: z.string(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  category: z.string(),
  title: z.string(),
  description: z.string(),
  evidence: z.array(z.string()),
  affectedArea: z.string(),
  recommendation: z.string(),
});

export const councilContextSchema = z.object({
  sessionId: z.string(),
  developmentRecord: z.object({
    sessionId: z.string(),
    timestamp: z.string(),
    summary: z.string(),
    futureImpact: z.string(),
    validation: z.object({
      build: z.boolean(),
      lint: z.boolean(),
      tests: z.boolean(),
    }),
    changes: z.object({
      filesChanged: z.array(z.string()),
      insertions: z.number(),
      deletions: z.number(),
    }),
    evidence: z.object({
      errors: z.number(),
      warnings: z.number(),
      patterns: z.number(),
      health: z.record(z.string(), z.number()),
    }),
  }),
  evidenceSnapshot: z.object({
    eventCount: z.number(),
    errorCount: z.number(),
    warningCount: z.number(),
    performanceSummary: z.object({
      memorySpikes: z.number(),
      cpuSpikes: z.number(),
      apiDurationsMs: z.array(z.number()),
    }),
    modifiedFiles: z.array(z.string()),
  }),
  commitContext: z.record(z.string(), z.unknown()),
  changedFiles: z.array(z.string()),
  validationResults: z.object({
    build: z.boolean(),
    lint: z.boolean(),
    tests: z.boolean(),
  }),
});
