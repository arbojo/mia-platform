import type { CouncilAuditReport, CouncilContext, CouncilRole } from '../types';
import { ArchitectRole } from '../roles/architect';
import { QARole } from '../roles/qa';
import { SecurityRole } from '../roles/security';
import { PerformanceRole } from '../roles/performance';
import { ProductRole } from '../roles/product';
import { Scheduler } from '../dispatcher/scheduler';
import { ParallelDispatcher } from '../dispatcher/parallel-dispatcher';
import { ResultCollector } from '../dispatcher/result-collector';

export class CouncilEngine {
  private readonly roles: CouncilRole[];
  private readonly scheduler: Scheduler;
  private readonly dispatcher: ParallelDispatcher;
  private readonly collector: ResultCollector;

  constructor(roles: CouncilRole[] = []) {
    this.roles = roles.length > 0 ? roles : [
      new ArchitectRole(),
      new QARole(),
      new SecurityRole(),
      new PerformanceRole(),
      new ProductRole(),
    ];
    this.scheduler = new Scheduler();
    this.dispatcher = new ParallelDispatcher();
    this.collector = new ResultCollector();
  }

  public async run(context: CouncilContext): Promise<CouncilAuditReport> {
    const schedule = this.scheduler.schedule(this.roles, context);
    const { results, wallClockMs } = await this.dispatcher.dispatch(schedule.rolesToExecute, context);
    const collected = this.collector.collect(results, wallClockMs);

    const summaryLines = [
      `Council Audit Complete`,
      '',
      `Roles: ${collected.rolesExecuted.length} executed`,
      `Findings: ${collected.findings.length}`,
      `Critical: 0`,
      `Warnings: ${collected.findings.filter((finding) => finding.severity === 'medium' || finding.severity === 'high' || finding.severity === 'critical').length}`,
      `Recommendations: ${collected.findings.filter((finding) => finding.recommendation).length}`,
    ];

    if (collected.rolesFailed.length > 0) {
      summaryLines.push(`Failed: ${collected.rolesFailed.join(', ')}`);
    }

    return {
      sessionId: context.sessionId,
      timestamp: new Date().toISOString(),
      rolesExecuted: collected.rolesExecuted,
      findings: collected.findings,
      summary: summaryLines.join('\n'),
      status: collected.rolesFailed.length > 0 ? 'partial' : 'complete',
      rolesFailed: collected.rolesFailed.length > 0 ? collected.rolesFailed : undefined,
      performanceMs: collected.wallClockMs,
    };
  }
}
