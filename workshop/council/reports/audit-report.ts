import type { CouncilAuditReport, CouncilFinding } from '../types';

export class AuditReportBuilder {
  public build(sessionId: string, rolesExecuted: string[], findings: CouncilFinding[]): CouncilAuditReport {
    return {
      sessionId,
      timestamp: new Date().toISOString(),
      rolesExecuted,
      findings,
      summary: `Council Audit Complete\nRoles: ${rolesExecuted.length} executed\nFindings: ${findings.length}`,
      status: 'complete',
    };
  }
}
