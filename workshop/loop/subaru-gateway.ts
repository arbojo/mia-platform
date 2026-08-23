import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

export interface SubaruGateway {
  checkpointEscalation(taskId: string, reason: string): void
}

export interface CliSubaruGatewayOptions {
  cwd?: string
  cliPath?: string
}

const DEFAULT_CLI_PATH = join('workshop', 'subaru', 'cli.ts')

export class CliSubaruGateway implements SubaruGateway {
  constructor(
    private readonly options: CliSubaruGatewayOptions = {},
  ) {}

  checkpointEscalation(taskId: string, reason: string): void {
    const proc = spawnSync(
      process.execPath,
      ['--import', 'tsx', this.options.cliPath ?? DEFAULT_CLI_PATH, 'block', taskId, '--reason', reason],
      { encoding: 'utf8', cwd: this.options.cwd },
    )
    if (proc.error) {
      const code = (proc.error as NodeJS.ErrnoException).code
      throw new Error(`subaru block could not start: ${code ?? proc.error.message}`)
    }
    if (proc.status !== 0) {
      throw new Error(`subaru block failed: ${(proc.stderr || proc.stdout || '').trim()}`)
    }
  }
}
