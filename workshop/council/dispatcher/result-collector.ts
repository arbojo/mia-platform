import type { CouncilFinding } from '../types';
import type { WorkerResult } from './parallel-dispatcher';

export interface CollectResult {
  findings: CouncilFinding[];
  rolesExecuted: string[];
  rolesFailed: string[];
  timing: { roleId: string; roleName: string; durationMs: number }[];
  totalDurationMs: number;
  wallClockMs: number;
}

export class ResultCollector {
  public collect(results: WorkerResult[], wallClockMs?: number): CollectResult {
    const findings: CouncilFinding[] = [];
    const rolesExecuted: string[] = [];
    const rolesFailed: string[] = [];
    const timing: { roleId: string; roleName: string; durationMs: number }[] = [];
    let totalDurationMs = 0;

    for (const result of results) {
      rolesExecuted.push(result.roleName);
      timing.push({ roleId: result.roleId, roleName: result.roleName, durationMs: result.durationMs });
      totalDurationMs += result.durationMs;

      if (result.error !== null) {
        rolesFailed.push(result.roleName);
      } else {
        findings.push(...result.findings);
      }
    }

    return { findings, rolesExecuted, rolesFailed, timing, totalDurationMs, wallClockMs: wallClockMs ?? totalDurationMs };
  }
}
