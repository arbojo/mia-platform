import { z } from 'zod';

export const councilSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const councilFindingStateSchema = z.enum(['open', 'in_progress', 'resolved', 'superseded', 'invalidated']);

export const councilFindingSchema = z.object({
  id: z.string(),
  role: z.string(),
  severity: councilSeveritySchema,
  category: z.string(),
  title: z.string(),
  description: z.string(),
  evidence: z.array(z.string()),
  affectedArea: z.string(),
  recommendation: z.string(),
  state: councilFindingStateSchema.optional(),
  filePath: z.string().optional(),
  headCommit: z.string().optional(),
});

export const councilConsensusSchema = z.object({
  agreement: z.enum(['low', 'medium', 'high']),
  confidence: z.number(),
  conflicts: z.array(z.string()),
});

export const councilReviewSchema = z.object({
  id: z.string(),
  roleId: z.string(),
  findingId: z.string(),
  observations: z.string(),
  impact: councilSeveritySchema,
  confidence: z.number(),
});

export const councilRoleDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  purpose: z.string(),
  responsibilities: z.array(z.string()),
  inputTypes: z.array(z.string()),
  outputType: z.string(),
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
  evidence: z.record(z.string(), z.unknown()).optional(),
  findings: z.array(councilFindingSchema).optional(),
  validations: z.record(z.string(), z.boolean()).optional(),
  artifacts: z.array(z.string()).optional(),
  git: z.record(z.string(), z.unknown()).optional(),
  affectedModules: z.array(z.string()).optional(),
  timeline: z.array(z.string()).optional(),
  availableRoles: z.array(councilRoleDefinitionSchema).optional(),
  reviews: z.array(councilReviewSchema).optional(),
  consensus: councilConsensusSchema.optional(),
});
