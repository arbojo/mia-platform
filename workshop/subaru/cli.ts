import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import path from 'node:path'
import { WorkflowEngine } from '../governance/workflow'
import { QUALITY_GATE_LABELS } from '../governance/types'
import {
  parseFrontmatter,
  serializeCheckpoint,
  buildCommitMessage,
  validateStep,
  flipStepCheckbox,
  scaffoldBlueprint,
  countCheckboxSteps,
  countCheckedSteps,
  findStepCheckbox,
  missingSteps,
  readNextAction,
  readSection,
  updateSection,
  updateNextAction,
  listStepCheckboxes,
  missingFrontmatterFields,
  secretScan,
  type CheckpointData,
  type ParsedCheckpoint,
  type SubaruState,
} from './lib'

export interface SubaruConfig {
  cwd: string
  remote: string
  checkpointRel: string
  agentRel: string
  globalAgentPath: string
  assertGovernance?: (governanceId: string) => void
  requiredGates?: (governanceId: string) => string[]
}

export class SubaruError extends Error {
  exitCode: number
  silent: boolean
  constructor(message: string, exitCode = 1, silent = false) {
    super(message)
    this.exitCode = exitCode
    this.silent = silent
  }
}

export class Subaru {
  cwd: string
  remote: string
  checkpointRel: string
  agentRel: string
  globalAgentPath: string
  governance: WorkflowEngine
  assertGovernanceFn: (governanceId: string) => void
  requiredGatesFn: (governanceId: string) => string[]

  constructor(config: Partial<SubaruConfig> = {}) {
    this.cwd = config.cwd ?? process.cwd()
    this.remote = config.remote ?? 'origin'
    this.checkpointRel = config.checkpointRel ?? 'docs/checkpoints/active-subaru-checkpoint.md'
    this.agentRel = config.agentRel ?? '.agents/subaru.md'
    this.globalAgentPath =
      config.globalAgentPath ?? path.join(os.homedir(), '.config', 'opencode', 'agent', 'subaru.md')
    this.governance = new WorkflowEngine()
    this.assertGovernanceFn = config.assertGovernance ?? ((id: string) => this.assertGovernanceApproved(id))
    this.requiredGatesFn =
      config.requiredGates ??
      ((id: string) => {
        const manifest = this.governance.assertGovernance(id)
        return manifest.classification.qualityGates.map((gate) => QUALITY_GATE_LABELS[gate] ?? gate)
      })
  }

  get checkpointPath(): string {
    return path.resolve(this.cwd, this.checkpointRel)
  }

  get agentPath(): string {
    return path.resolve(this.cwd, this.agentRel)
  }

  fail(message: string): never {
    throw new SubaruError(message)
  }

  git(args: string[], allowFail = false): string | null {
    const result = spawnSync('git', args, { encoding: 'utf8', cwd: this.cwd })
    if (result.status !== 0) {
      if (allowFail) return null
      throw new SubaruError(`git ${args[0]} failed: ${(result.stderr || result.stdout).toString().trim()}`)
    }
    return (result.stdout || '').toString().trim()
  }

  currentBranch(): string {
    return this.git(['rev-parse', '--abbrev-ref', 'HEAD']) ?? 'HEAD'
  }

  parseFlags(args: string[]): Record<string, string | number | boolean | undefined> {
    const flags: Record<string, string | number | boolean | undefined> = {}
    for (let i = 0; i < args.length; i++) {
      const arg = args[i]
      switch (arg) {
        case '--title':
          flags.title = args[++i]
          break
        case '--steps':
          flags.steps = Number(args[++i])
          break
        case '--governance':
          flags.governance = args[++i]
          break
        case '--force':
          flags.force = true
          break
        case '--confirm-gates':
          flags.confirmGates = true
          break
        case '--no-pull':
          flags.noPull = true
          break
        default:
          this.fail(`Unknown flag: ${arg}`)
      }
    }
    return flags
  }

  readCheckpoint(): ParsedCheckpoint | null {
    if (!existsSync(this.checkpointPath)) return null
    return parseFrontmatter(readFileSync(this.checkpointPath, 'utf8'))
  }

  requireData(data: Partial<CheckpointData>): CheckpointData {
    const missing = missingFrontmatterFields(data)
    if (missing.length > 0) {
      this.fail(`Checkpoint incompleto (faltan: ${missing.join(', ')}). Usa \`subaru freeze\` primero.`)
    }
    return {
      taskId: data.taskId!,
      title: data.title!,
      state: data.state!,
      currentStep: data.currentStep ?? 0,
      totalSteps: data.totalSteps!,
      branch: data.branch!,
      lastMachine: data.lastMachine ?? os.hostname(),
      governanceId: data.governanceId,
      created: data.created!,
      updated: data.updated!,
    }
  }

  mustCheckpoint(taskId: string): ParsedCheckpoint {
    const checkpoint = this.readCheckpoint()
    if (!checkpoint) this.fail('No hay checkpoint. Ejecuta `subaru freeze` primero.')
    if (checkpoint.data.taskId !== taskId) {
      this.fail(`El checkpoint pertenece a otra misión: ${checkpoint.data.taskId ?? '(sin task_id)'}.`)
    }
    return checkpoint
  }

  assertGovernanceApproved(governanceId: string): void {
    try {
      const manifest = this.governance.assertGovernance(governanceId)
      if (manifest.status !== 'approved') {
        this.fail(`Governance ${governanceId} no está aprobado (status: ${manifest.status}).`)
      }
    } catch (err) {
      this.fail(`Bloqueado por governance: ${(err as Error).message}`)
    }
  }

  scanSecrets(body: string, action: string): void {
    const found = secretScan(body)
    if (found.length > 0) {
      this.fail(
        `${action} bloqueado: el checkpoint contiene posibles secretos (${found.join(', ')}). No escribas secretos en el checkpoint: usa variables de entorno.`
      )
    }
  }

  commitAndPush(state: SubaruState, taskId: string): void {
    const message = buildCommitMessage(taskId, state)
    const branch = this.currentBranch()

    this.git(['add', this.checkpointRel])

    const commitRes = spawnSync('git', ['commit', '-m', message], { encoding: 'utf8', cwd: this.cwd })
    if (commitRes.status !== 0) {
      const stderr = (commitRes.stderr || '').toString()
      if (/nothing to commit/.test(stderr)) {
        console.log(`  ✓ Sin cambios nuevos que commitear (${message})`)
        return
      }
      throw new SubaruError(`git commit failed: ${stderr.trim()}`)
    }

    const pushRes = spawnSync('git', ['push', this.remote, branch], { encoding: 'utf8', cwd: this.cwd })
    if (pushRes.status !== 0) {
      const sha = this.git(['rev-parse', '--short', 'HEAD']) ?? '?'
      console.error(`  ⚠ LOCAL CHECKPOINT: commit local OK (${sha})`)
      console.error(`  ⚠ REMOTE CHECKPOINT: NO sincronizado — el push falló.`)
      console.error(`  → El checkpoint NO está protegido en GitHub todavía.`)
      console.error(`  → Corre: git pull --rebase ${this.remote} ${branch} && npx tsx workshop/subaru/cli.ts revive`)
      throw new SubaruError('push failed', 1, true)
    }
    console.log(`  ✓ Commit + push: ${message}`)
  }

  printCheckpointSummary(data: Partial<CheckpointData>): void {
    console.log('')
    console.log('── SUBARU CHECKPOINT ───────────────────────────────')
    console.log(`  Task:      ${data.taskId ?? '(sin task_id)'}`)
    console.log(`  Title:     ${data.title ?? '(sin título)'}`)
    console.log(`  State:     ${data.state ?? '(sin estado)'}`)
    console.log(`  Step:      ${data.currentStep ?? 0}/${data.totalSteps ?? '?'}`)
    console.log(`  Branch:    ${data.branch ?? '?'}`)
    console.log(`  Machine:   ${data.lastMachine ?? '?'}`)
    if (data.governanceId) console.log(`  Govern.:   ${data.governanceId}`)
    console.log(`  Updated:   ${data.updated ?? '?'}`)
  }

  cmdFreeze(args: string[]): void {
    const taskId = args[0]
    const flags = this.parseFlags(args.slice(1))
    if (!taskId || !flags.title || !flags.steps) {
      this.fail('Usage: subaru freeze <task-id> --title "<title>" --steps <n> --governance <id> [--force]')
    }
    if (!flags.governance) {
      this.fail('freeze requiere --governance <task-id>: el concilio debe aprobar antes de congelar.')
    }
    if (!Number.isInteger(flags.steps) || (flags.steps as number) < 1) {
      this.fail('--steps debe ser un entero >= 1.')
    }

    this.assertGovernanceFn(flags.governance as string)

    const current = this.readCheckpoint()
    if (current) {
      const prevTask = current.data.taskId
      const prevState = current.data.state
      if (prevTask && prevTask !== taskId && prevState && prevState !== 'completed' && !flags.force) {
        this.fail(`Hay una misión activa ("${prevTask}", state: ${prevState}). Usa --force para sobrescribir.`)
      }
    }

    const now = new Date().toISOString()

    let body = current?.body ?? ''
    const hasPlan = countCheckboxSteps(body) > 0
    const belongsToMission = current?.data.taskId === taskId || !current?.data.taskId
    if (!hasPlan || !belongsToMission) {
      body = scaffoldBlueprint({
        taskId,
        title: flags.title as string,
        governanceId: flags.governance as string,
        steps: flags.steps as number,
      })
    }

    const bodySteps = countCheckboxSteps(body)
    let totalSteps = flags.steps as number
    if (bodySteps !== flags.steps) {
      console.warn(`  ⚠ --steps ${flags.steps} no coincide con los ${bodySteps} checkboxes del body. Se usa ${bodySteps}.`)
      totalSteps = bodySteps || (flags.steps as number)
    }

    const data: CheckpointData = {
      taskId,
      title: flags.title as string,
      state: 'frozen',
      currentStep: 0,
      totalSteps,
      branch: this.currentBranch(),
      lastMachine: os.hostname(),
      governanceId: flags.governance as string,
      created: current?.data.created ?? now,
      updated: now,
    }

    this.scanSecrets(body, 'freeze')
    writeFileSync(this.checkpointPath, serializeCheckpoint(data, body), 'utf8')
    console.log(`✓ Blueprint congelado: ${taskId} (${totalSteps} pasos)`)
    this.commitAndPush('frozen', taskId)
    console.log('  → Ahora implementa los pasos y marca avance con `subaru mark <id> <n>`.')
  }

  cmdMark(args: string[]): void {
    const taskId = args[0]
    const stepArg = args[1]
    this.parseFlags(args.slice(2))
    if (!taskId || !stepArg) this.fail('Usage: subaru mark <task-id> <step>')

    const step = Number(stepArg)
    const checkpoint = this.mustCheckpoint(taskId)
    const data = this.requireData(checkpoint.data)
    if (data.state === 'completed') this.fail(`La misión ${taskId} ya está completada.`)
    if (!validateStep(step, data.totalSteps)) this.fail(`Paso ${step} fuera de rango (1..${data.totalSteps}).`)

    const expected = (data.currentStep ?? 0) + 1
    if (step < expected) {
      console.log(`✓ Paso ${step}/${data.totalSteps} ya estaba marcado.`)
      return
    }
    if (step !== expected) {
      this.fail(`Paso ${step} fuera de secuencia: se esperaba ${expected}. Marca en orden (current_step = ${data.currentStep}).`)
    }

    const box = findStepCheckbox(checkpoint.body, step)
    if (!box) {
      this.fail(`El body del checkpoint no tiene el checkbox "Paso ${step}:". Revisa la sección "Approved plan" o congela de nuevo.`)
    }

    const updated: CheckpointData = {
      ...data,
      state: 'in_progress',
      currentStep: step,
      lastMachine: os.hostname(),
      updated: new Date().toISOString(),
    }

    let body = flipStepCheckbox(checkpoint.body, step)
    const nextAction =
      step < updated.totalSteps
        ? `Implementar el Paso ${step + 1} (ver sección "Approved plan") y luego ejecutar \`subaru mark ${taskId} ${step + 1}\`.`
        : `Todos los pasos marcados. Ejecutar \`subaru complete ${taskId}\` cuando pasen los gates de verificación.`
    body = updateNextAction(body, nextAction)

    this.scanSecrets(body, 'mark')
    writeFileSync(this.checkpointPath, serializeCheckpoint(updated, body), 'utf8')
    console.log(`✓ Paso ${step}/${data.totalSteps} marcado`)
    this.commitAndPush('in_progress', taskId)
    console.log(`  → Siguiente: ${nextAction}`)
  }

  cmdComplete(args: string[]): void {
    const taskId = args[0]
    const flags = this.parseFlags(args.slice(1))
    if (!taskId) this.fail('Usage: subaru complete <task-id> [--confirm-gates]')

    const checkpoint = this.mustCheckpoint(taskId)
    const data = this.requireData(checkpoint.data)
    if (data.state === 'completed') {
      console.log(`✓ La misión ${taskId} ya estaba completada.`)
      return
    }

    const missing = missingSteps(checkpoint.body)
    if (missing.length > 0) {
      this.fail(`complete bloqueado: pasos sin completar en el body: ${missing.join(', ')}.`)
    }
    if ((data.currentStep ?? 0) !== data.totalSteps) {
      this.fail(`complete bloqueado: current_step ${data.currentStep} != total_steps ${data.totalSteps}.`)
    }
    if (!data.governanceId) {
      this.fail('complete bloqueado: la misión no tiene governance_id. No se puede verificar la aprobación.')
    }
    this.assertGovernanceFn(data.governanceId)

    const gates = this.requiredGatesFn(data.governanceId)
    if (!flags.confirmGates) {
      console.log('complete bloqueado: confirma los gates de verificación con --confirm-gates.')
      console.log('  Gates requeridos por el manifest governance:')
      for (const gate of gates) console.log(`    - ${gate}`)
      this.fail(
        'Ejecuta `subaru complete <id> --confirm-gates` solo cuando todos los gates hayan pasado (lint, build, unit_tests, e2e_tests, chrome_devtools, security_review).'
      )
    }

    const now = new Date().toISOString()
    const resultBody = updateSection(
      checkpoint.body,
      'Current state',
      `- Misión ${taskId} completada (${data.totalSteps}/${data.totalSteps} pasos).\n- Gates confirmados: ${gates.join(', ')}.\n- Finalizado: ${now}.`
    )
    const updated: CheckpointData = {
      ...data,
      state: 'completed',
      currentStep: data.totalSteps,
      lastMachine: os.hostname(),
      updated: now,
    }
    this.scanSecrets(resultBody, 'complete')
    writeFileSync(this.checkpointPath, serializeCheckpoint(updated, resultBody), 'utf8')
    console.log(`✓ Misión ${taskId} completada (${gates.length} gates confirmados)`)
    this.commitAndPush('completed', taskId)
  }

  cmdStatus(): void {
    const checkpoint = this.readCheckpoint()
    if (!checkpoint) {
      console.log('No hay checkpoint en docs/checkpoints/active-subaru-checkpoint.md.')
      console.log('Inicia una misión con: npx tsx workshop/subaru/cli.ts freeze <id> --title "<t>" --steps <n> --governance <task-id>')
      return
    }
    this.printCheckpointSummary(checkpoint.data)
    if (checkpoint.data.state === 'completed') {
      console.log('  → Misión completada. Inicia una nueva con `subaru freeze`.')
    } else {
      const next = (checkpoint.data.currentStep ?? 0) + 1
      console.log(
        '  → Siguiente: ' +
          (next > (checkpoint.data.totalSteps ?? 0)
            ? `subaru complete ${checkpoint.data.taskId}`
            : `subaru mark ${checkpoint.data.taskId} ${next}`)
      )
    }
  }

  detectDrift(checkpoint: ParsedCheckpoint, data: CheckpointData, branch: string): string[] {
    const issues: string[] = []

    const checkpointClean = this.git(['diff', '--quiet', 'HEAD', '--', this.checkpointRel], true) !== null
    if (!checkpointClean) {
      issues.push('El checkpoint fue modificado localmente sin commit (edición manual). El CLI es la única autoridad que lo modifica.')
    }

    const checked = countCheckedSteps(checkpoint.body)
    if (data.currentStep !== checked) {
      issues.push(`Contradicción: frontmatter current_step = ${data.currentStep} pero el body tiene ${checked} checkboxes marcados.`)
    }
    const total = countCheckboxSteps(checkpoint.body)
    if (data.state === 'completed' && checked < total) {
      issues.push(`Estado "completed" pero quedan pasos sin marcar (${total - checked}): complete prematuro detectado.`)
    }
    if (data.totalSteps !== total) {
      issues.push(`Contradicción: frontmatter total_steps = ${data.totalSteps} pero el body tiene ${total} checkboxes.`)
    }

    const porcelain = this.git(['status', '--porcelain']) ?? ''
    const dirtyLines = porcelain
      .split(/\r?\n/)
      .filter((line) => line.trim() !== '' && !line.includes(this.checkpointRel))
    if (dirtyLines.length > 0) {
      issues.push(`Working tree sucio (${dirtyLines.length} cambio/s sin commitear): ${dirtyLines.map((l) => l.trim().replace(/\s+/g, ' ').slice(0, 80)).join(' | ')}`)
    }

    const branchStatus = this.git(['status', '--short', '--branch']) ?? ''
    const aheadMatch = branchStatus.match(/ahead (\d+)/)
    if (aheadMatch) {
      const localLast = this.git(['log', '-1', '--format=%h', '--grep=subaru: checkpoint'], true)
      const remoteLast = this.git(['log', '-1', '--format=%h', '--grep=subaru: checkpoint', `${this.remote}/${branch}`], true)
      if (localLast && remoteLast && localLast !== remoteLast) {
        issues.push(
          `REMOTE CHECKPOINT desactualizado: el último checkpoint local (${localLast}) no está en ${this.remote}/${branch} (${remoteLast}). Los marks no se pushearon.`
        )
      }
    }

    const remoteCommits = this.git(['log', '--oneline', `HEAD..${this.remote}/${branch}`], true)
    if (remoteCommits) {
      const commits = remoteCommits.split(/\r?\n/).filter((line) => line.trim() !== '')
      if (commits.length > 0) {
        const preview = commits.slice(0, 5).join(' | ')
        issues.push(
          `El remoto avanzó ${commits.length} commit/s que el local no tiene (ejecuta \`git pull --rebase ${this.remote} ${branch}\` antes de continuar): ${preview}${commits.length > 5 ? ' …' : ''}`
        )
      }
    }

    return issues
  }

  cmdRevive(args: string[]): void {
    const flags = this.parseFlags(args)
    const branch = this.currentBranch()

    if (!flags.noPull) {
      console.log(`→ git pull --rebase ${this.remote} ${branch}`)
      try {
        this.git(['pull', '--rebase', this.remote, branch])
      } catch (err) {
        console.error(`  ⚠ Pull falló: ${(err as Error).message}`)
        throw new SubaruError('pull failed', 1)
      }
    }

    const checkpoint = this.readCheckpoint()
    if (!checkpoint) {
      console.log('No hay checkpoint. Esta máquina no tiene misión que retomar.')
      return
    }

    const missing = missingFrontmatterFields(checkpoint.data)
    if (missing.length > 0) {
      console.error('CHECKPOINT ILEGIBLE / CORRUPTO')
      console.error(`  Faltan campos del frontmatter: ${missing.join(', ')}`)
      console.error('  No se puede continuar. Revisa docs/checkpoints/active-subaru-checkpoint.md o revive desde otra máquina con git pull.')
      throw new SubaruError('checkpoint ilegible', 1, true)
    }

    const data = this.requireData(checkpoint.data)
    const drift = this.detectDrift(checkpoint, data, branch)

    const stateLabel = data.state === 'completed' ? 'COMPLETED' : data.state === 'frozen' ? 'FROZEN' : 'IN_PROGRESS'

    const boxes = listStepCheckboxes(checkpoint.body)
    const done = boxes.filter((b) => b.checked)
    const pending = boxes.filter((b) => !b.checked)

    console.log('')
    console.log('SUBARU REVIVE')
    console.log('')
    console.log(`Mission: ${data.title}`)
    console.log(`Task ID: ${data.taskId}`)
    if (data.governanceId) console.log(`Governance: ${data.governanceId}`)
    console.log(`Branch: ${branch}`)
    console.log('')
    console.log(`State: ${stateLabel}`)
    console.log('')
    console.log('Completed:')
    if (done.length === 0) console.log('  (ninguno)')
    for (const b of done) console.log(`  [x] Step ${b.step} ${b.text.replace(/^- \[x\] \*\*Paso \d+:\*\*/, '').trim()}`)
    console.log('')
    console.log('Next:')
    if (pending.length === 0) console.log('  (sin pasos pendientes)')
    for (const b of pending.slice(0, 1)) console.log(`  [ ] Step ${b.step} ${b.text.replace(/^- \[ \] \*\*Paso \d+:\*\*/, '').trim()}`)
    console.log('')
    console.log('Next action:')
    const fallbackAction = `Implementar el Paso ${(data.currentStep ?? 0) + 1} y ejecutar \`subaru mark ${data.taskId} ${(data.currentStep ?? 0) + 1}\`.`
    console.log(`  ${readNextAction(checkpoint.body) || fallbackAction}`)
    console.log('')
    console.log('Files expected:')
    console.log(`  ${readSection(checkpoint.body, 'Scope') || '(sin sección Scope)'}`)
    console.log('')
    console.log('Constraints:')
    console.log(`  ${readSection(checkpoint.body, 'Constraints') || '(sin sección Constraints)'}`)
    console.log('')
    console.log('Required verification:')
    console.log(`  ${readSection(checkpoint.body, 'Verification') || '(sin sección Verification)'}`)
    console.log('')
    console.log('DO NOT:')
    console.log(`  ${readSection(checkpoint.body, 'Non-goals') || '(sin sección Non-goals)'}`)
    console.log('')

    if (drift.length > 0) {
      console.log('DRIFT DETECTED')
      for (const issue of drift) console.log(`  • ${issue}`)
      console.log('')
      console.log('BLOCKED — HUMAN/COUNCIL INPUT REQUIRED')
      console.log('No continúes. Resuelve la contradicción antes de cualquier mark/complete.')
      throw new SubaruError('drift detected', 1, true)
    }

    console.log('Recovery status:')
    console.log('SAFE TO CONTINUE')
  }

  gitIdentity(): { name: string | null; email: string | null } {
    const name = this.git(['config', 'user.name'], true)
    const email = this.git(['config', 'user.email'], true)
    return { name, email }
  }

  cmdBootstrap(): void {
    console.log('── SUBARU BOOTSTRAP ────────────────────────────────')

    const nodeVersion = spawnSync('node', ['--version'], { encoding: 'utf8', cwd: this.cwd })
    const nodeOk = nodeVersion.status === 0 && (nodeVersion.stdout || '').trim() !== ''
    console.log(`  ${nodeOk ? '✓' : '✗'} Node.js:      ${nodeOk ? nodeVersion.stdout.trim() : '(no detectado)'}`)

    const gitVersion = spawnSync('git', ['--version'], { encoding: 'utf8', cwd: this.cwd })
    const gitOk = gitVersion.status === 0
    console.log(`  ${gitOk ? '✓' : '✗'} Git:          ${gitOk ? gitVersion.stdout.trim() : '(no detectado)'}`)

    const isRepo = this.git(['rev-parse', '--is-inside-work-tree'], true) === 'true'
    console.log(`  ${isRepo ? '✓' : '✗'} Repositorio:  ${isRepo ? this.cwd : '(no es un repo git)'}`)

    let remoteOk = false
    let remoteDetail = '(sin remotes)'
    if (isRepo) {
      const remotes = this.git(['remote'], true)
      if (remotes) {
        const names = remotes.split(/\r?\n/)
        remoteDetail = names.join(', ')
        remoteOk = names.includes(this.remote)
      }
    }
    console.log(`  ${remoteOk ? '✓' : '✗'} Remote:       ${remoteOk ? `${this.remote} (${remoteDetail})` : `${remoteDetail} — falta ${this.remote}`}`)

    const agentOk = existsSync(this.agentPath)
    console.log(`  ${agentOk ? '✓' : '✗'} Agente espejo: ${agentOk ? this.agentRel : '(faltante: no se puede restaurar el agente)'}`)

    const cpOk = existsSync(this.checkpointPath)
    console.log(`  ${cpOk ? '✓' : '✗'} Checkpoint:   ${cpOk ? this.checkpointRel : '(sin checkpoint: usa freeze para iniciar una misión)'}`)

    const identity = this.gitIdentity()
    const identityOk = Boolean(identity.name && identity.email)
    console.log(
      `  ${identityOk ? '✓' : '✗'} Identidad git: ${identityOk ? `${identity.name} <${identity.email}>` : '(no configurada — freeze/mark/complete fallarán en el commit)'}`
    )

    if (!identityOk) {
      console.log('  → Configura: git config user.email "you@example.com" && git config user.name "Your Name" (o con --global)')
    }

    if (!agentOk) {
      console.warn('  ⚠ Falta el espejo .agents/subaru.md en el repo. No se puede restaurar el agente.')
    } else if (existsSync(this.globalAgentPath)) {
      console.log(`  ✓ Agente global ya existe: ${this.globalAgentPath}`)
    } else {
      mkdirSync(path.dirname(this.globalAgentPath), { recursive: true })
      copyFileSync(this.agentPath, this.globalAgentPath)
      console.log(`  ✓ Agente global restaurado desde ${this.agentRel}`)
      console.log('  → Reinicia opencode para que cargue el agente restaurado.')
    }

    const broken = !nodeOk || !gitOk || !isRepo || !remoteOk
    if (broken) {
      console.log('  ✗ Bootstrap INCOMPLETO: el entorno no está listo.')
      this.fail('bootstrap: el entorno no está listo (revisa los checks con ✗)')
    }
    console.log('  → Listo. Ejecuta: npx tsx workshop/subaru/cli.ts revive')
  }

  printHelp(): void {
    console.log(`
PROTOCOL SUBARU — Resurrección multi-máquina de tareas

USAGE:
  npx tsx workshop/subaru/cli.ts <command> [options]

COMMANDS:
  freeze <id> --title "<t>" --steps <n> --governance <task-id> [--force]
      Congela el blueprint (frontmatter + commit + push) DESPUÉS de la
      aprobación del concilio y ANTES de codificar. Valida que el manifest
      de governance esté aprobado. Commit: "subaru: checkpoint <id> - listo".
  mark <id> <step>
      Marca un paso completado EN SECUENCIA (solo current_step + 1).
      State in_progress, tick del checkbox, actualiza "Next action" + commit/push.
  complete <id> [--confirm-gates]
      Cierra la misión SOLO si: todos los checkboxes [x], current_step ==
      total_steps, governance aprobado y --confirm-gates (lista los gates
      obligatorios del manifest governance y escribe el resultado final).
      State completed + commit/push.
  revive [--no-pull]
      git pull --rebase + validación de legibilidad + drift detection +
      informe operativo (SUBARU REVIVE). DRIFT DETECTED + BLOCKED si el
      repositorio contradice el checkpoint.
  status
      Muestra el estado actual del checkpoint.
  bootstrap
      Valida entorno (node/git remote) y restaura el agente global desde .agents/subaru.md.
  help | --help
      Muestra esta ayuda.

COMMIT FORMAT:
  subaru: checkpoint <id> - listo|en-progreso|completado|bloqueado
`)
  }

  run(command: string, args: string[]): number {
    try {
      switch (command) {
        case 'freeze':
          this.cmdFreeze(args)
          break
        case 'mark':
          this.cmdMark(args)
          break
        case 'complete':
          this.cmdComplete(args)
          break
        case 'revive':
          this.cmdRevive(args)
          break
        case 'status':
          this.cmdStatus()
          break
        case 'bootstrap':
          this.cmdBootstrap()
          break
        case 'help':
        case '--help':
        case '-h':
          this.printHelp()
          break
        case undefined:
          this.printHelp()
          break
        default:
          this.fail(`Unknown command: ${command}`)
      }
      return 0
    } catch (err) {
      if (err instanceof SubaruError) {
        if (!err.silent) console.error(`✗ ${err.message}`)
        return err.exitCode
      }
      console.error(`✗ ${(err as Error).message}`)
      return 1
    }
  }
}

export function runSubaruCommand(command: string, args: string[], config?: Partial<SubaruConfig>): number {
  return new Subaru(config).run(command, args)
}

function main(): void {
  const code = runSubaruCommand(process.argv[2], process.argv.slice(3))
  process.exit(code)
}

const isMain =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
