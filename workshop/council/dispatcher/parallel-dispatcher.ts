import type { CouncilContext, CouncilRole } from '../types';
import type { ExecutionPolicy } from './execution-policy';
import { DEFAULT_EXECUTION_POLICY } from './execution-policy';
import { withTimeout } from './timeout-wrapper';

export interface WorkerResult {
  roleId: string;
  roleName: string;
  findings: import('../types').CouncilFinding[];
  durationMs: number;
  error: string | null;
}

export interface DispatchOutput {
  results: WorkerResult[];
  wallClockMs: number;
}

export class ParallelDispatcher {
  private readonly defaultPolicy: ExecutionPolicy;

  constructor(policy?: Partial<ExecutionPolicy>) {
    this.defaultPolicy = { ...DEFAULT_EXECUTION_POLICY, ...policy };
  }

  public async dispatch(
    roles: CouncilRole[],
    context: CouncilContext,
    policy?: Partial<ExecutionPolicy>,
  ): Promise<DispatchOutput> {
    const config = { ...this.defaultPolicy, ...policy };
    const dispatchStart = performance.now();

    const tasks = roles.map(async (role) => {
      const start = performance.now();
      try {
        const findings = await withTimeout(
          Promise.resolve(role.audit(context)),
          config.timeoutMs,
        );
        return {
          roleId: role.id,
          roleName: role.name,
          findings,
          durationMs: Math.round(performance.now() - start),
          error: null,
        } satisfies WorkerResult;
      } catch (error) {
        return {
          roleId: role.id,
          roleName: role.name,
          findings: [],
          durationMs: Math.round(performance.now() - start),
          error: error instanceof Error ? error.message : String(error),
        } satisfies WorkerResult;
      }
    });

    const settled = await Promise.allSettled(tasks);

    const results: WorkerResult[] = settled.map((result) => {
      if (result.status === 'fulfilled') return result.value;
      return {
        roleId: 'unknown',
        roleName: 'unknown',
        findings: [],
        durationMs: 0,
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      };
    });

    return {
      results,
      wallClockMs: Math.round(performance.now() - dispatchStart),
    };
  }
}
