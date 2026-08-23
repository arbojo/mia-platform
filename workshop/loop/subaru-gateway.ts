import { spawnSync } from 'node:child_process'

export interface SubaruGateway {
  checkpointEscalation(taskId: string, reason: string): void
}

const CLI_RELATIVE_PATH = ['workshop', 'subaru', 'cli.ts']

export class CliSubaruGateway implements SubaruGateway {
  checkpointEscalation(taskId: string, reason: string): void {
    const proc = spawnSync(
      process.execPath,
      ['--import', 'tsx', ...CLI_RELATIVE_PATH, 'block', taskId, '--reason', reason],
      { encoding: 'utf8' },
    )
    if (proc.status !== 0) {
      throw new Error(`subaru block failed: ${(proc.stderr || proc.stdout || '').trim()}`)
    }
  }
}
