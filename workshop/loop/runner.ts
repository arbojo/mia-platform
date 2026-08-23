import { spawnSync } from 'node:child_process'

export interface RunnerOptions {
  prompt: string
  model: string
  sessionId?: string
  timeoutMs?: number
}

export interface RunResult {
  exitCode: number | null
  stdout: string
  stderr: string
  timedOut: boolean
  durationMs: number
}

export interface OpenCodeRunner {
  run(options: RunnerOptions): RunResult
}

const DEFAULT_TIMEOUT_MS = 600_000

export function extractSessionId(stdout: string): string | undefined {
  const match = /"sessionID"\s*:\s*"(ses_[A-Za-z0-9]+)"/.exec(stdout)
  return match?.[1]
}

export class CliOpenCodeRunner implements OpenCodeRunner {
  run(options: RunnerOptions): RunResult {
    const args = ['run', options.prompt, '--model', options.model, '--format', 'json']
    if (options.sessionId) args.push('-s', options.sessionId)
    const startedAt = Date.now()
    const result = spawnSync('opencode', args, {
      encoding: 'utf8',
      timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
    })
    return {
      exitCode: result.status,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      timedOut: (result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT',
      durationMs: Date.now() - startedAt,
    }
  }
}
