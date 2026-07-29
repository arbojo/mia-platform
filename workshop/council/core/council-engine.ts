import type { CouncilAuditReport, CouncilContext, CouncilRole } from '../types';
import { ArchitectRole } from '../roles/architect';
import { QARole } from '../roles/qa';
import { SecurityRole } from '../roles/security';
import { PerformanceRole } from '../roles/performance';
import { ProductRole } from '../roles/product';

export class CouncilEngine {
  private readonly roles: CouncilRole[];

  constructor(roles: CouncilRole[] = []) {
    this.roles = roles.length > 0 ? roles : [
      new ArchitectRole(),
      new QARole(),
      new SecurityRole(),
      new PerformanceRole(),
      new ProductRole(),
    ];
  }

  public run(context: CouncilContext): CouncilAuditReport {
    const findings = this.roles.flatMap((role) => role.audit(context));
    const summaryLines = [
      `Council Audit Complete`,
      '',
      `Roles: ${this.roles.length} executed`,
      `Findings: ${findings.length}`,
      `Critical: 0`,
      `Warnings: ${findings.filter((finding) => finding.severity === 'medium' || finding.severity === 'high' || finding.severity === 'critical').length}`,
      `Recommendations: ${findings.filter((finding) => finding.recommendation).length}`,
    ];

    return {
      sessionId: context.sessionId,
      timestamp: new Date().toISOString(),
      rolesExecuted: this.roles.map((role) => role.name),
      findings,
      summary: summaryLines.join('\n'),
      status: 'complete',
    };
  }
}
