import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { runSubaruCommand, type SubaruConfig } from './cli'
import { parseFrontmatter } from './lib'

const GOVERNANCE_OK = 'TASK-APPROVED'
const GOVERNANCE_NO = 'TASK-NOT-APPROVED'

function approvedStub(governanceId: string): void {
  if (governanceId === GOVERNANCE_NO) {
    throw new Error(
      `Task manifest ${governanceId} is not approved (status: awaiting_council). Governance check blocked.`
    )
  }
}

const tmpDirs: string[] = []

function cleanup(): void {
  while (tmpDirs.length > 0) {
    const dir = tmpDirs.pop()!
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

afterEach(cleanup)

function run(cmd: string, args: string[], cwd: string): { status: number; stdout: string; stderr: string } {
  const res = spawnSync(cmd, args, { encoding: 'utf8', cwd })
  return { status: res.status ?? -1, stdout: res.stdout ?? '', stderr: res.stderr ?? '' }
}

function makeRepo(label: string): { repo: string; remote: string } {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), `subaru-${label}-`))
  tmpDirs.push(base)
  const repo = path.join(base, 'work')
  const remote = path.join(base, 'remote.git')
  fs.mkdirSync(path.join(repo, 'docs', 'checkpoints'), { recursive: true })
  run('git', ['init', '-b', 'main'], repo)
  run('git', ['init', '--bare', '-b', 'main', remote], repo)
  run('git', ['config', 'user.email', 'test@mia.local'], repo)
  run('git', ['config', 'user.name', 'Subaru Test'], repo)
  run('git', ['remote', 'add', 'origin', remote], repo)
  fs.writeFileSync(path.join(repo, 'README.md'), '# test\n', 'utf8')
  run('git', ['add', '.'], repo)
  run('git', ['commit', '-m', 'init'], repo)
  return { repo, remote }
}

function cloneRepo(remotePath: string): string {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'subaru-clone-'))
  tmpDirs.push(base)
  const clone = path.join(base, 'work')
  run('git', ['clone', remotePath, clone], base)
  run('git', ['config', 'user.email', 'test@mia.local'], clone)
  run('git', ['config', 'user.name', 'Subaru Test'], clone)
  return clone
}

function readCheckpoint(cwd: string): { data: Record<string, string | number | boolean | undefined>; body: string } {
  const raw = fs.readFileSync(path.join(cwd, 'docs', 'checkpoints', 'active-subaru-checkpoint.md'), 'utf8')
  return parseFrontmatter(raw)
}

function subaru(
  cwd: string,
  command: string,
  args: string[],
  opts: { realGovernance?: boolean; requiredGates?: () => string[] } = {}
): { code: number; out: string } {
  const chunks: string[] = []
  const origLog = console.log
  const origError = console.error
  console.log = (...a: unknown[]) => chunks.push(a.join(' '))
  console.error = (...a: unknown[]) => chunks.push(a.join(' '))
  let code: number
  try {
    const config: Partial<SubaruConfig> = { cwd }
    if (!opts.realGovernance) {
      config.assertGovernance = approvedStub
      config.requiredGates = opts.requiredGates ?? (() => ['lint', 'build', 'unit_tests', 'e2e_tests', 'chrome_devtools', 'security_review'])
    }
    code = runSubaruCommand(command, args, config)
  } finally {
    console.log = origLog
    console.error = origError
  }
  return { code, out: chunks.join('\n') }
}

describe('freeze (governance + scaffold)', () => {
  it('scaffolds the blueprint, writes the checkpoint and pushes it', () => {
    const { repo, remote } = makeRepo('freeze-ok')
    const res = subaru(repo, 'freeze', ['mia-x', '--title', 'Misión X', '--steps', '3', '--governance', GOVERNANCE_OK])
    expect(res.code).toBe(0)

    const cp = readCheckpoint(repo)
    expect(cp.data.taskId).toBe('mia-x')
    expect(cp.data.state).toBe('frozen')
    expect(cp.data.currentStep).toBe(0)
    expect(cp.data.totalSteps).toBe(3)
    expect(cp.data.governanceId).toBe(GOVERNANCE_OK)
    for (const heading of ['## Mission', '## Scope', '## Non-goals', '## Approved plan', '## Current state', '## Next action', '## Constraints', '## Verification', '## Recovery instructions']) {
      expect(cp.body).toContain(heading)
    }
    expect(cp.body.match(/- \[ \] \*\*Paso \d+:/g)).toHaveLength(3)

    const remoteHead = run('git', ['log', '-1', '--format=%s', 'origin/main'], repo).stdout.trim()
    expect(remoteHead).toBe('subaru: checkpoint mia-x - listo')
    const remoteExists = fs.existsSync(path.join(remote, 'objects'))
    expect(remoteExists).toBe(true)
  })

  it('rejects freeze without --governance', () => {
    const { repo } = makeRepo('freeze-nogov')
    const res = subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2'])
    expect(res.code).toBe(1)
    expect(res.out).toContain('--governance')
  })

  it('rejects freeze with a non-approved governance id', () => {
    const { repo } = makeRepo('freeze-govno')
    const res = subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_NO])
    expect(res.code).toBe(1)
    expect(res.out.toLowerCase()).toContain('governance')
  })

  it('blocks freeze over an active mission unless --force is used', () => {
    const { repo } = makeRepo('freeze-guard')
    subaru(repo, 'freeze', ['mia-a', '--title', 'A', '--steps', '2', '--governance', GOVERNANCE_OK])
    const res = subaru(repo, 'freeze', ['mia-b', '--title', 'B', '--steps', '2', '--governance', GOVERNANCE_OK])
    expect(res.code).toBe(1)
    expect(res.out).toContain('misión activa')

    const forced = subaru(repo, 'freeze', ['mia-b', '--title', 'B', '--steps', '2', '--governance', GOVERNANCE_OK, '--force'])
    expect(forced.code).toBe(0)
    expect(readCheckpoint(repo).data.taskId).toBe('mia-b')
  })

  it('reconciles total_steps with the actual number of checkboxes', () => {
    const { repo } = makeRepo('freeze-reconcile')
    const res = subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '7', '--governance', GOVERNANCE_OK])
    expect(res.code).toBe(0)
    expect(readCheckpoint(repo).data.totalSteps).toBe(7)
  })

  it('blocks freeze when the blueprint contains a secret', () => {
    const { repo } = makeRepo('freeze-secret')
    const res = subaru(repo, 'freeze', [
      'mia-x',
      '--title',
      'Misión sk-ABC123456789',
      '--steps',
      '2',
      '--governance',
      GOVERNANCE_OK,
    ])
    expect(res.code).toBe(1)
    expect(res.out).toContain('posibles secretos')
    expect(res.out).toContain('clave API sk-')
    expect(fs.existsSync(path.join(repo, 'docs', 'checkpoints', 'active-subaru-checkpoint.md'))).toBe(false)
  })

  it('connects to the real governance wiring and blocks unknown manifests', () => {
    const { repo } = makeRepo('freeze-real-gov')
    const res = subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', 'TASK-NOT-REAL-000000'], {
      realGovernance: true,
    })
    expect(res.code).toBe(1)
    expect(res.out.toLowerCase()).toContain('governance')
  })
})

describe('mark (secuencial)', () => {
  it('rejects mark before freeze', () => {
    const { repo } = makeRepo('mark-before-freeze')
    const res = subaru(repo, 'mark', ['mia-x', '1'])
    expect(res.code).toBe(1)
    expect(res.out).toContain('No hay checkpoint')
  })

  it('marks steps in order and updates current_step', () => {
    const { repo } = makeRepo('mark-seq')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '3', '--governance', GOVERNANCE_OK])
    const m1 = subaru(repo, 'mark', ['mia-x', '1'])
    expect(m1.code).toBe(0)
    let cp = readCheckpoint(repo)
    expect(cp.data.state).toBe('in_progress')
    expect(cp.data.currentStep).toBe(1)

    expect(subaru(repo, 'mark', ['mia-x', '2']).code).toBe(0)
    cp = readCheckpoint(repo)
    expect(cp.data.currentStep).toBe(2)
    expect(cp.body).toContain('- [x] **Paso 1:')
    expect(cp.body).toContain('- [x] **Paso 2:')
  })

  it('rejects out-of-sequence steps', () => {
    const { repo } = makeRepo('mark-skip')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '3', '--governance', GOVERNANCE_OK])
    const res = subaru(repo, 'mark', ['mia-x', '2'])
    expect(res.code).toBe(1)
    expect(res.out).toContain('fuera de secuencia')
    expect(res.out).toContain('se esperaba 1')
  })

  it('is idempotent when re-marking an already-marked step', () => {
    const { repo } = makeRepo('mark-idem')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    subaru(repo, 'mark', ['mia-x', '1'])
    const logBefore = run('git', ['log', '--oneline'], repo).stdout.split('\n').filter(Boolean).length
    const again = subaru(repo, 'mark', ['mia-x', '1'])
    expect(again.code).toBe(0)
    expect(again.out).toContain('ya estaba marcado')
    const logAfter = run('git', ['log', '--oneline'], repo).stdout.split('\n').filter(Boolean).length
    expect(logAfter).toBe(logBefore)
  })

  it('fails when the body has no checkbox for the expected step', () => {
    const { repo } = makeRepo('mark-missing-box')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    subaru(repo, 'mark', ['mia-x', '1'])
    const cpPath = path.join(repo, 'docs', 'checkpoints', 'active-subaru-checkpoint.md')
    const raw = fs.readFileSync(cpPath, 'utf8').replace('- [ ] **Paso 2:', '- [ ] **Paso X:')
    fs.writeFileSync(cpPath, raw, 'utf8')
    const res = subaru(repo, 'mark', ['mia-x', '2'])
    expect(res.code).toBe(1)
    expect(res.out).toContain('no tiene el checkbox')
  })

  it('rejects mark on a completed mission', () => {
    const { repo } = makeRepo('mark-completed')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '1', '--governance', GOVERNANCE_OK])
    subaru(repo, 'mark', ['mia-x', '1'])
    subaru(repo, 'complete', ['mia-x', '--confirm-gates'])
    const res = subaru(repo, 'mark', ['mia-x', '1'])
    expect(res.code).toBe(1)
    expect(res.out).toContain('ya está completada')
  })
})

describe('complete (verificado)', () => {
  it('blocks complete while steps remain unchecked', () => {
    const { repo } = makeRepo('complete-pending')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '3', '--governance', GOVERNANCE_OK])
    subaru(repo, 'mark', ['mia-x', '1'])
    const res = subaru(repo, 'complete', ['mia-x'])
    expect(res.code).toBe(1)
    expect(res.out).toContain('pasos sin completar')
  })

  it('blocks complete when governance_id is missing', () => {
    const { repo } = makeRepo('complete-nogov')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '1', '--governance', GOVERNANCE_OK])
    subaru(repo, 'mark', ['mia-x', '1'])
    const cpPath = path.join(repo, 'docs', 'checkpoints', 'active-subaru-checkpoint.md')
    const raw = fs.readFileSync(cpPath, 'utf8').replace(/governance_id: .*\n/, '')
    fs.writeFileSync(cpPath, raw, 'utf8')
    const res = subaru(repo, 'complete', ['mia-x'])
    expect(res.code).toBe(1)
    expect(res.out).toContain('governance_id')
  })

  it('blocks complete without --confirm-gates and lists the required gates', () => {
    const { repo } = makeRepo('complete-gates')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '1', '--governance', GOVERNANCE_OK])
    subaru(repo, 'mark', ['mia-x', '1'])
    const res = subaru(repo, 'complete', ['mia-x'])
    expect(res.code).toBe(1)
    expect(res.out).toContain('--confirm-gates')
    expect(res.out).toContain('lint')
    expect(res.out).toContain('security_review')
    expect(readCheckpoint(repo).data.state).toBe('in_progress')
  })

  it('completes a fully-marked mission with --confirm-gates, commits and pushes the final state', () => {
    const { repo } = makeRepo('complete-ok')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    subaru(repo, 'mark', ['mia-x', '1'])
    subaru(repo, 'mark', ['mia-x', '2'])
    const res = subaru(repo, 'complete', ['mia-x', '--confirm-gates'])
    expect(res.code).toBe(0)

    const cp = readCheckpoint(repo)
    expect(cp.data.state).toBe('completed')
    expect(cp.data.currentStep).toBe(2)
    expect(cp.body).toContain('## Current state')
    expect(cp.body).toMatch(/Misión mia-x completada/)
    expect(cp.body).toMatch(/Gates confirmados/)
    const remoteHead = run('git', ['log', '-1', '--format=%s', 'origin/main'], repo).stdout.trim()
    expect(remoteHead).toBe('subaru: checkpoint mia-x - completado')
  })
})

describe('revive (return-by-death)', () => {
  it('reports no checkpoint and returns success', () => {
    const { repo } = makeRepo('revive-empty')
    const res = subaru(repo, 'revive', ['--no-pull'])
    expect(res.code).toBe(0)
    expect(res.out).toContain('No hay checkpoint')
  })

  it('fails safely on a corrupt checkpoint', () => {
    const { repo } = makeRepo('revive-corrupt')
    fs.writeFileSync(
      path.join(repo, 'docs', 'checkpoints', 'active-subaru-checkpoint.md'),
      '---\ntask_id: mia-x\n---\nbody roto',
      'utf8'
    )
    run('git', ['add', '.'], repo)
    run('git', ['commit', '-m', 'corrupt cp'], repo)
    const res = subaru(repo, 'revive', ['--no-pull'])
    expect(res.code).toBe(1)
    expect(res.out).toContain('CHECKPOINT ILEGIBLE / CORRUPTO')
    expect(res.out).toContain('title')
  })

  it('returns the exact next step for a coherent in-progress checkpoint', () => {
    const { repo } = makeRepo('revive-coherent')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '3', '--governance', GOVERNANCE_OK])
    subaru(repo, 'mark', ['mia-x', '1'])
    const res = subaru(repo, 'revive', ['--no-pull'])
    expect(res.code).toBe(0)
    expect(res.out).toContain('SUBARU REVIVE')
    expect(res.out).toContain('SAFE TO CONTINUE')
    expect(res.out).toMatch(/\[x\] Step 1/)
    expect(res.out).toMatch(/\[ \] Step 2/)
    expect(res.out).toMatch(/subaru mark mia-x 2/)
  })

  it('accepts legacy bluepready_ready checkpoints without drift', () => {
    const { repo } = makeRepo('revive-legacy')
    const legacy = `---
task_id: legacy-x
title: Misión legacy
state: blueprint_ready
current_step: 0
total_steps: 2
branch: main
last_machine: oldbox
governance_id: TASK-APPROVED
created: 2026-01-01T00:00:00.000Z
updated: 2026-01-01T00:00:00.000Z
---

# ⛩️ PROTOCOL SUBARU: Checkpoint Activo

## Mission

Misión legacy

## Approved plan

- [ ] **Paso 1:** a
- [ ] **Paso 2:** b
`
    fs.writeFileSync(path.join(repo, 'docs', 'checkpoints', 'active-subaru-checkpoint.md'), legacy, 'utf8')
    run('git', ['add', '.'], repo)
    run('git', ['commit', '-m', 'legacy cp'], repo)
    const res = subaru(repo, 'revive', ['--no-pull'])
    expect(res.code).toBe(0)
    expect(res.out).toContain('SAFE TO CONTINUE')
    expect(res.out).toContain('FROZEN')
  })

  it('detects drift from uncommitted changes and blocks', () => {
    const { repo } = makeRepo('revive-drift-dirty')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    subaru(repo, 'mark', ['mia-x', '1'])
    fs.writeFileSync(path.join(repo, 'TODO.txt'), 'cambio sin commit', 'utf8')
    const res = subaru(repo, 'revive', ['--no-pull'])
    expect(res.code).toBe(1)
    expect(res.out).toContain('DRIFT DETECTED')
    expect(res.out).toContain('BLOCKED — HUMAN/COUNCIL INPUT REQUIRED')
  })

  it('detects drift when the checkpoint was edited by hand', () => {
    const { repo } = makeRepo('revive-drift-hand')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    const cpPath = path.join(repo, 'docs', 'checkpoints', 'active-subaru-checkpoint.md')
    fs.writeFileSync(cpPath, fs.readFileSync(cpPath, 'utf8') + '\n# edición manual\n', 'utf8')
    const res = subaru(repo, 'revive', ['--no-pull'])
    expect(res.code).toBe(1)
    expect(res.out).toContain('DRIFT DETECTED')
  })

  it('reports the commits the remote advanced when the local is behind', () => {
    const a = makeRepo('revive-drift-behind')
    subaru(a.repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '3', '--governance', GOVERNANCE_OK])
    subaru(a.repo, 'mark', ['mia-x', '1'])
    const b = cloneRepo(a.remote)
    subaru(a.repo, 'mark', ['mia-x', '2'])
    run('git', ['fetch', 'origin'], b)
    const res = subaru(b, 'revive', ['--no-pull'])
    expect(res.code).toBe(1)
    expect(res.out).toContain('El remoto avanzó')
    expect(res.out).toContain('subaru: checkpoint mia-x - en-progreso')
    expect(res.out).toContain('DRIFT DETECTED')
  })

  it('blocks mark when the body contains a secret', () => {
    const { repo } = makeRepo('revive-mark-secret')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    const cpPath = path.join(repo, 'docs', 'checkpoints', 'active-subaru-checkpoint.md')
    fs.appendFileSync(cpPath, '\nsk-ABC123456789\n', 'utf8')
    const res = subaru(repo, 'mark', ['mia-x', '1'])
    expect(res.code).toBe(1)
    expect(res.out).toContain('posibles secretos')
  })

  it('detects incoherence between frontmatter and body', () => {
    const { repo } = makeRepo('revive-incoherent')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '3', '--governance', GOVERNANCE_OK])
    subaru(repo, 'mark', ['mia-x', '1'])
    const cpPath = path.join(repo, 'docs', 'checkpoints', 'active-subaru-checkpoint.md')
    const raw = fs.readFileSync(cpPath, 'utf8').replace('current_step: 1', 'current_step: 3')
    fs.writeFileSync(cpPath, raw, 'utf8')
    const res = subaru(repo, 'revive', ['--no-pull'])
    expect(res.code).toBe(1)
    expect(res.out).toContain('DRIFT DETECTED')
    expect(res.out).toContain('Contradicción')
  })

  it('survives death across machines: A freezes/marks, B revives and finishes', () => {
    const a = makeRepo('revive-death')
    subaru(a.repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '3', '--governance', GOVERNANCE_OK])
    subaru(a.repo, 'mark', ['mia-x', '1'])

    const b = cloneRepo(a.remote)
    const rev = subaru(b, 'revive', [])
    expect(rev.code).toBe(0)
    expect(rev.out).toContain('SAFE TO CONTINUE')

    expect(subaru(b, 'mark', ['mia-x', '2']).code).toBe(0)
    expect(subaru(b, 'mark', ['mia-x', '3']).code).toBe(0)
    expect(subaru(b, 'complete', ['mia-x', '--confirm-gates']).code).toBe(0)

    const remoteHead = run('git', ['log', '-1', '--format=%s', 'origin/main'], b).stdout.trim()
    expect(remoteHead).toBe('subaru: checkpoint mia-x - completado')
  })
})

describe('block (misiones bloqueadas)', () => {
  it('blocks a mission, records the reason and commits the blocked state', () => {
    const { repo } = makeRepo('block-ok')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    subaru(repo, 'mark', ['mia-x', '1'])
    const res = subaru(repo, 'block', ['mia-x', '--reason', 'Gate unit_tests bloqueado por fallo pre-existente'])
    expect(res.code).toBe(0)

    const cp = readCheckpoint(repo)
    expect(cp.data.state).toBe('blocked')
    expect(cp.body).toContain('BLOQUEADA')
    expect(cp.body).toContain('fallo pre-existente')
    const remoteHead = run('git', ['log', '-1', '--format=%s', 'origin/main'], repo).stdout.trim()
    expect(remoteHead).toBe('subaru: checkpoint mia-x - bloqueado')
  })

  it('rejects block without --reason', () => {
    const { repo } = makeRepo('block-noreason')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    const res = subaru(repo, 'block', ['mia-x'])
    expect(res.code).toBe(1)
    expect(res.out).toContain('--reason')
    expect(readCheckpoint(repo).data.state).toBe('frozen')
  })

  it('is idempotent on an already blocked mission', () => {
    const { repo } = makeRepo('block-idem')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    subaru(repo, 'block', ['mia-x', '--reason', 'motivo'])
    const logBefore = run('git', ['log', '--oneline'], repo).stdout.split('\n').filter(Boolean).length
    const again = subaru(repo, 'block', ['mia-x', '--reason', 'otro'])
    expect(again.code).toBe(0)
    expect(again.out).toContain('ya estaba bloqueada')
    const logAfter = run('git', ['log', '--oneline'], repo).stdout.split('\n').filter(Boolean).length
    expect(logAfter).toBe(logBefore)
  })
})

describe('push failures', () => {
  it('keeps the local checkpoint and reports the missing remote checkpoint', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'subaru-pushfail-'))
    tmpDirs.push(base)
    const repo = path.join(base, 'work')
    fs.mkdirSync(path.join(repo, 'docs', 'checkpoints'), { recursive: true })
    run('git', ['init', '-b', 'main'], repo)
    run('git', ['config', 'user.email', 'test@mia.local'], repo)
    run('git', ['config', 'user.name', 'Subaru Test'], repo)
    run('git', ['remote', 'add', 'origin', path.join(base, 'does-not-exist.git')], repo)
    fs.writeFileSync(path.join(repo, 'README.md'), 'x', 'utf8')
    run('git', ['add', '.'], repo)
    run('git', ['commit', '-m', 'init'], repo)

    const res = subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    expect(res.code).toBe(1)
    expect(res.out).toContain('LOCAL CHECKPOINT')
    expect(res.out).toContain('REMOTE CHECKPOINT')
    expect(res.out).toContain('push falló')

    const localHead = run('git', ['log', '-1', '--format=%s'], repo).stdout.trim()
    expect(localHead).toBe('subaru: checkpoint mia-x - listo')
  })
})

describe('bootstrap (entorno)', () => {
  it('reports all environment checks on a valid repo', () => {
    const { repo } = makeRepo('bootstrap-ok')
    const res = subaru(repo, 'bootstrap', [])
    expect(res.code).toBe(0)
    expect(res.out).toContain('Node.js')
    expect(res.out).toContain('Git:')
    expect(res.out).toContain('Repositorio')
    expect(res.out).toContain('Remote:')
    expect(res.out).toContain('Checkpoint:')
    expect(res.out).toContain('Identidad git')
    expect(res.out).toContain('test@mia.local')
  })

  it('detects a missing git identity and suggests the fix', () => {
    const { repo } = makeRepo('bootstrap-noidentity')
    run('git', ['config', '--unset', 'user.email'], repo)
    run('git', ['config', '--unset', 'user.name'], repo)
    const prevGlobal = process.env.GIT_CONFIG_GLOBAL
    process.env.GIT_CONFIG_GLOBAL = '/dev/null'
    try {
      const res = subaru(repo, 'bootstrap', [])
      expect(res.code).toBe(0)
      expect(res.out).toContain('Identidad git')
      expect(res.out).toContain('no configurada')
      expect(res.out).toContain('git config user.email')
    } finally {
      if (prevGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL
      else process.env.GIT_CONFIG_GLOBAL = prevGlobal
    }
  })

  it('fails on a directory that is not a git repository', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'subaru-bootstrap-norepo-'))
    tmpDirs.push(base)
    const res = subaru(base, 'bootstrap', [])
    expect(res.code).toBe(1)
    expect(res.out).toContain('no es un repo git')
  })
})

describe('enrich (blueprint enrichment)', () => {
  function writeJson(cwd: string, data: object): string {
    const p = path.join(cwd, 'enrich-data.json')
    fs.writeFileSync(p, JSON.stringify(data), 'utf8')
    return p
  }

  it('enriches sections and step attributes without advancing progress', () => {
    const { repo } = makeRepo('enrich-ok')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    const jsonPath = writeJson(repo, {
      sections: { Scope: 'archivos A, B', 'Non-goals': 'no tocar C' },
      steps: [{ step: 1, attrs: { Objetivo: 'crear evidence.ts', Archivos: 'src/reasoning/evidence.ts' } }],
    })
    const res = subaru(repo, 'enrich', ['mia-x', '--data', jsonPath])
    expect(res.code).toBe(0)

    const cp = readCheckpoint(repo)
    expect(cp.data.state).toBe('frozen')
    expect(cp.data.currentStep).toBe(0)
    expect(cp.body).toContain('archivos A, B')
    expect(cp.body).toContain('no tocar C')
    expect(cp.body).toContain('crear evidence.ts')
    expect(cp.body).toContain('- [ ] **Paso 1:**')
    expect(cp.body).toContain('- [ ] **Paso 2:**')
    expect(cp.body).not.toContain('- [x]')
  })

  it('Z1 — rejects enrich on nonexistent checkpoint', () => {
    const { repo } = makeRepo('enrich-nocp')
    const jsonPath = writeJson(repo, { sections: { Scope: 'x' } })
    const res = subaru(repo, 'enrich', ['mia-x', '--data', jsonPath])
    expect(res.code).toBe(1)
    expect(res.out).toContain('No hay checkpoint')
  })

  it('Z2 — rejects enrich on a different active mission', () => {
    const { repo } = makeRepo('enrich-diff')
    subaru(repo, 'freeze', ['mia-a', '--title', 'A', '--steps', '2', '--governance', GOVERNANCE_OK])
    const jsonPath = writeJson(repo, { sections: { Scope: 'x' } })
    const res = subaru(repo, 'enrich', ['mia-b', '--data', jsonPath])
    expect(res.code).toBe(1)
    expect(res.out).toContain('otra misión')
  })

  it('Z3 — enrichment does not increment current_step', () => {
    const { repo } = makeRepo('enrich-noinc')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    const jsonPath = writeJson(repo, { sections: { Scope: 'updated' } })
    subaru(repo, 'enrich', ['mia-x', '--data', jsonPath])
    const cp = readCheckpoint(repo)
    expect(cp.data.currentStep).toBe(0)
  })

  it('Z4 — enrichment does not change frozen state', () => {
    const { repo } = makeRepo('enrich-nostate')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    const jsonPath = writeJson(repo, { sections: { Scope: 'updated' } })
    subaru(repo, 'enrich', ['mia-x', '--data', jsonPath])
    const cp = readCheckpoint(repo)
    expect(cp.data.state).toBe('frozen')
  })

  it('Z5 — enrichment preserves governance_id', () => {
    const { repo } = makeRepo('enrich-gov')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    const jsonPath = writeJson(repo, { sections: { Scope: 'updated' } })
    subaru(repo, 'enrich', ['mia-x', '--data', jsonPath])
    const cp = readCheckpoint(repo)
    expect(cp.data.governanceId).toBe(GOVERNANCE_OK)
  })

  it('Z6 — blocks enrichment containing secrets', () => {
    const { repo } = makeRepo('enrich-secret')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    const jsonPath = writeJson(repo, { sections: { Scope: 'usa sk-FAKE123456ABCDEF' } })
    const res = subaru(repo, 'enrich', ['mia-x', '--data', jsonPath])
    expect(res.code).toBe(1)
    expect(res.out).toContain('posibles secretos')
  })

  it('Z7 — enriched checkpoint survives revive without drift', () => {
    const { repo } = makeRepo('enrich-revive')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    const jsonPath = writeJson(repo, { sections: { Scope: 'archivos enriquecidos' } })
    subaru(repo, 'enrich', ['mia-x', '--data', jsonPath])
    fs.unlinkSync(jsonPath)
    const res = subaru(repo, 'revive', ['--no-pull'])
    expect(res.code).toBe(0)
    expect(res.out).toContain('SAFE TO CONTINUE')
  })

  it('Z8 — enriched checkpoint survives push/pull round-trip', () => {
    const a = makeRepo('enrich-roundtrip')
    subaru(a.repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    const jsonPath = writeJson(a.repo, { sections: { Scope: 'contenido enriquecido' } })
    subaru(a.repo, 'enrich', ['mia-x', '--data', jsonPath])
    fs.unlinkSync(jsonPath)

    const b = cloneRepo(a.remote)
    const rev = subaru(b, 'revive', [])
    expect(rev.code).toBe(0)
    expect(rev.out).toContain('SAFE TO CONTINUE')
    const cp = readCheckpoint(b)
    expect(cp.body).toContain('contenido enriquecido')
    expect(cp.data.currentStep).toBe(0)
    expect(cp.data.state).toBe('frozen')
  })

  it('Z9 — cannot use enrich to fake step completion', () => {
    const { repo } = makeRepo('enrich-fake')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    const cpBefore = readCheckpoint(repo)
    const beforeChecked = cpBefore.body.match(/- \[x\]/g)?.length ?? 0
    const jsonPath = writeJson(repo, { sections: { Scope: 'x' } })
    subaru(repo, 'enrich', ['mia-x', '--data', jsonPath])
    const cpAfter = readCheckpoint(repo)
    const afterChecked = cpAfter.body.match(/- \[x\]/g)?.length ?? 0
    expect(afterChecked).toBe(beforeChecked)
    expect(cpAfter.data.currentStep).toBe(0)
  })

  it('Z10 — enrich + revive recovers at same step', () => {
    const { repo } = makeRepo('enrich-revive-step')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '3', '--governance', GOVERNANCE_OK])
    const jsonPath = writeJson(repo, {
      sections: { Scope: 'proyecto completo' },
      steps: [{ step: 2, attrs: { Objetivo: 'crear state.ts' } }],
    })
    subaru(repo, 'enrich', ['mia-x', '--data', jsonPath])
    fs.unlinkSync(jsonPath)
    const res = subaru(repo, 'revive', ['--no-pull'])
    expect(res.code).toBe(0)
    expect(res.out).toContain('FROZEN')
    expect(res.out).toContain('Step 1')
    const cp = readCheckpoint(repo)
    expect(cp.data.currentStep).toBe(0)
    expect(cp.data.totalSteps).toBe(3)
    expect(cp.body).toContain('proyecto completo')
    expect(cp.body).toContain('crear state.ts')
  })

  it('rejects enrich without --data', () => {
    const { repo } = makeRepo('enrich-nodata')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    const res = subaru(repo, 'enrich', ['mia-x'])
    expect(res.code).toBe(1)
    expect(res.out).toContain('--data')
  })

  it('rejects enrich with invalid JSON file', () => {
    const { repo } = makeRepo('enrich-badjson')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    const badPath = path.join(repo, 'bad.json')
    fs.writeFileSync(badPath, '{not json', 'utf8')
    const res = subaru(repo, 'enrich', ['mia-x', '--data', badPath])
    expect(res.code).toBe(1)
    expect(res.out).toContain('No se pudo leer')
  })

  it('rejects step attribute update for out-of-range step', () => {
    const { repo } = makeRepo('enrich-oob')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    const jsonPath = writeJson(repo, { steps: [{ step: 5, attrs: { Objetivo: 'x' } }] })
    const res = subaru(repo, 'enrich', ['mia-x', '--data', jsonPath])
    expect(res.code).toBe(1)
    expect(res.out).toContain('fuera de rango')
  })
})

describe('preflight (session continuity)', () => {
  it('P1 — no checkpoint returns SAFE_FOR_NEW_MISSION', () => {
    const { repo } = makeRepo('preflight-empty')
    const res = subaru(repo, 'preflight', [])
    expect(res.code).toBe(0)
    expect(res.out).toContain('SAFE_FOR_NEW_MISSION')
  })

  it('P2 — active checkpoint returns REVIVE_REQUIRED', () => {
    const { repo } = makeRepo('preflight-active')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    const res = subaru(repo, 'preflight', [])
    expect(res.code).toBe(0)
    expect(res.out).toContain('REVIVE_REQUIRED')
    expect(res.out).toContain('ACTIVE_CHECKPOINT: mia-x')
    expect(res.out).toContain('subaru mark mia-x 1')
    expect(res.out).toContain('revive')
  })

  it('P3 — different active mission returns STOP_FOR_HUMAN', () => {
    const { repo } = makeRepo('preflight-diff')
    subaru(repo, 'freeze', ['mia-a', '--title', 'A', '--steps', '2', '--governance', GOVERNANCE_OK])
    const res = subaru(repo, 'preflight', [])
    expect(res.code).toBe(0)
    expect(res.out).toContain('REVIVE_REQUIRED')
    expect(res.out).toContain('mia-a')
  })

  it('P4 — blocked checkpoint returns STOP_FOR_HUMAN', () => {
    const { repo } = makeRepo('preflight-blocked')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    subaru(repo, 'block', ['mia-x', '--reason', 'gate failed'])
    const res = subaru(repo, 'preflight', [])
    expect(res.code).toBe(0)
    expect(res.out).toContain('STOP_FOR_HUMAN')
    expect(res.out).toContain('CHECKPOINT_BLOCKED')
  })

  it('P5 — drifted checkpoint returns STOP_FOR_HUMAN', () => {
    const { repo } = makeRepo('preflight-drift')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    fs.writeFileSync(path.join(repo, 'TODO.txt'), 'untracked', 'utf8')
    const res = subaru(repo, 'preflight', [])
    expect(res.code).toBe(0)
    expect(res.out).toContain('STOP_FOR_HUMAN')
    expect(res.out).toContain('DRIFT_DETECTED')
  })

  it('P6 — invalid checkpoint returns STOP_FOR_HUMAN', () => {
    const { repo } = makeRepo('preflight-invalid')
    fs.writeFileSync(
      path.join(repo, 'docs', 'checkpoints', 'active-subaru-checkpoint.md'),
      '---\ntask_id: mia-x\n---\nbody',
      'utf8'
    )
    run('git', ['add', '.'], repo)
    run('git', ['commit', '-m', 'corrupt'], repo)
    const res = subaru(repo, 'preflight', [])
    expect(res.code).toBe(0)
    expect(res.out).toContain('STOP_FOR_HUMAN')
    expect(res.out).toContain('CHECKPOINT_INVALID')
  })

  it('P7 — preflight does not modify checkpoint', () => {
    const { repo } = makeRepo('preflight-readonly')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    const before = readCheckpoint(repo)
    subaru(repo, 'preflight', [])
    const after = readCheckpoint(repo)
    expect(after.data.state).toBe(before.data.state)
    expect(after.data.currentStep).toBe(before.data.currentStep)
    expect(after.data.totalSteps).toBe(before.data.totalSteps)
    expect(after.data.governanceId).toBe(before.data.governanceId)
    expect(after.body).toBe(before.body)
  })

  it('P8 — repeated preflight returns same result', () => {
    const { repo } = makeRepo('preflight-repeat')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    const r1 = subaru(repo, 'preflight', [])
    const r2 = subaru(repo, 'preflight', [])
    expect(r1.out).toBe(r2.out)
    expect(r1.code).toBe(r2.code)
  })

  it('P9 — conversational reset returns same repository result', () => {
    const { repo } = makeRepo('preflight-reset')
    subaru(repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '2', '--governance', GOVERNANCE_OK])
    const res = subaru(repo, 'preflight', [])
    expect(res.out).toContain('REVIVE_REQUIRED')
    expect(res.out).toContain('mia-x')
  })

  it('P10 — fresh clone after git sync discovers same checkpoint', () => {
    const a = makeRepo('preflight-clone')
    subaru(a.repo, 'freeze', ['mia-x', '--title', 'X', '--steps', '3', '--governance', GOVERNANCE_OK])
    subaru(a.repo, 'mark', ['mia-x', '1'])

    const b = cloneRepo(a.remote)
    const res = subaru(b, 'preflight', [])
    expect(res.code).toBe(0)
    expect(res.out).toContain('REVIVE_REQUIRED')
    expect(res.out).toContain('mia-x')
    expect(res.out).toContain('1/3')
  })
})
