export interface ExecutionPolicy {
  timeoutMs: number;
  continueOnFailure: boolean;
  maxConcurrency?: number;
}

export const DEFAULT_EXECUTION_POLICY: ExecutionPolicy = {
  timeoutMs: 30000,
  continueOnFailure: true,
};
