import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

export type GateName = 'lint' | 'build' | 'test:unit'

export interface GateRunner {
  run(gates: readonly GateName[]): Record<string, boolean>
}

function resolveNpmCli(): string | undefined {
  const candidate = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  return existsSync(candidate) ? candidate : undefined
}

export class NpmGateRunner implements GateRunner {
  run(gates: readonly GateName[]): Record<string, boolean> {
    const results: Record<string, boolean> = {}
    const npmCli = resolveNpmCli()
    for (const gate of gates) {
      const proc = npmCli
        ? spawnSync(process.execPath, [npmCli, 'run', gate], { encoding: 'utf8' })
        : spawnSync('npm', ['run', gate], { encoding: 'utf8', shell: process.platform === 'win32' })
      results[gate] = proc.status === 0
    }
    return results
  }
}
