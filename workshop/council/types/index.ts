import type { z } from 'zod';
import type {
  councilSeveritySchema,
  councilFindingSchema,
  councilContextSchema,
} from '../schemas';

export type CouncilSeverity = z.infer<typeof councilSeveritySchema>;

export type CouncilFinding = z.infer<typeof councilFindingSchema>;

export type CouncilContext = z.infer<typeof councilContextSchema>;

export interface CouncilRole {
  id: string;
  name: string;
  responsibility: string;
  audit(context: CouncilContext): CouncilFinding[];
}

export interface CouncilAuditReport {
  sessionId: string;
  timestamp: string;
  rolesExecuted: string[];
  findings: CouncilFinding[];
  summary: string;
  status: 'complete' | 'partial';
}

export type CouncilDecisionFrameworkContext = Pick<
  CouncilContext,
  'findings' | 'availableRoles' | 'reviews' | 'consensus'
>;
