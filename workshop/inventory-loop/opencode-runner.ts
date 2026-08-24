import { spawnSync } from 'node:child_process'
import type { WorkerRunResult, WorkerRunner } from './loop'

export interface RunnerRequest {
  prompt: string
  model: string
  sessionId?: string | null
}

const DEFAULT_TIMEOUT_MS = 600_000

export function extractSessionId(stdout: string): string | undefined {
  const match = /"sessionID"\s*:\s*"(ses_[A-Za-z0-9]+)"/.exec(stdout)
  return match?.[1]
}

export function extractWorkerText(stdout: string): string {
  const texts: string[] = []
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{')) continue
    try {
      const event = JSON.parse(trimmed) as { type?: string; part?: { type?: string; text?: string } }
      if (event.type === 'text' && typeof event.part?.text === 'string') {
        texts.push(event.part.text)
      }
    } catch {
      continue
    }
  }
  return texts.length > 0 ? texts.join('\n') : stdout
}

export class CliOpenCodeWorkerRunner implements WorkerRunner {
  async run(options: RunnerRequest): Promise<WorkerRunResult> {
    const args = ['run', options.prompt, '--model', options.model, '--format', 'json']
    if (options.sessionId) args.push('-s', options.sessionId)
    const result = spawnSync('opencode', args, {
      encoding: 'utf8',
      timeout: DEFAULT_TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
    })
    const errorCode = (result.error as NodeJS.ErrnoException | undefined)?.code
    const sessionId = extractSessionId(result.stdout ?? '')
    return {
      exitCode: result.status,
      ...(errorCode !== undefined ? { errorCode } : {}),
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      timedOut: errorCode === 'ETIMEDOUT',
      ...(sessionId !== undefined ? { sessionId } : {}),
    }
  }
}
