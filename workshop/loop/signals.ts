import { RepeatedErrorRule } from '../intelligence/rules/repeated-error-rule'
import type { WorkshopEvent } from '../types'
import type { RunResult } from './runner'

export type LoopSignal = 'SUCCESS' | 'FAILURE' | 'TIMEOUT' | 'INFRA_FAILURE'
export type AttemptSignal = LoopSignal | 'STUCK'

export interface AttemptRecord {
  worker: string
  model: string
  signal: AttemptSignal
  exitCode: number | null
  durationMs: number
}

const INFRA_SPAWN_ERROR_CODES: ReadonlySet<string> = new Set(['ENOENT', 'EACCES'])

export function classifyRun(result: RunResult): LoopSignal {
  if (result.timedOut) return 'TIMEOUT'
  if (result.exitCode === null) return 'INFRA_FAILURE'
  if (result.errorCode !== undefined && INFRA_SPAWN_ERROR_CODES.has(result.errorCode)) {
    return 'INFRA_FAILURE'
  }
  return result.exitCode === 0 ? 'SUCCESS' : 'FAILURE'
}

function toWorkshopEvents(attempts: readonly AttemptRecord[]): WorkshopEvent[] {
  return attempts.map((attempt, index) => ({
    id: `loop-attempt-${index}`,
    timestamp: new Date().toISOString(),
    sessionId: 'engineering-loop',
    source: 'System',
    category: 'Errors',
    severity: 'error',
    action: `attempt:${attempt.worker}:${attempt.signal}`,
    module: 'engineering-loop',
    metadata: { model: attempt.model },
    duration: attempt.durationMs,
  }))
}

export function detectStuck(attempts: readonly AttemptRecord[]): boolean {
  const findings = new RepeatedErrorRule().evaluate(toWorkshopEvents(attempts), 'engineering-loop')
  return findings.length > 0
}
