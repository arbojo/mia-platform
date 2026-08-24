import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import type { CheckpointGateway } from './loop'

export interface CliCheckpointGatewayOptions {
  repoRoot: string
  checkpointId: string
  cliPath?: string
}

export class CliCheckpointGateway implements CheckpointGateway {
  constructor(private readonly options: CliCheckpointGatewayOptions) {}

  async checkpoint(reason: string): Promise<void> {
    const cliPath = this.options.cliPath ?? join('workshop', 'subaru', 'cli.ts')
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', cliPath, 'block', this.options.checkpointId, '--reason', reason],
      { encoding: 'utf8', cwd: this.options.repoRoot, timeout: 120_000 },
    )
    if (result.error) throw result.error
    if (result.status !== 0) {
      throw new Error(
        `subaru block exited ${result.status}: ${(result.stderr || result.stdout || '').trim().slice(-400)}`,
      )
    }
  }
}
