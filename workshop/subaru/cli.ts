import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import {
  parseFrontmatter,
  serializeCheckpoint,
  buildCommitMessage,
  validateStep,
  flipStepCheckbox,
  type CheckpointData,
  type ParsedCheckpoint,
  type SubaruState,
} from './lib'

const CHECKPOINT_PATH = path.resolve(process.cwd(), 'docs/checkpoints/active-subaru-checkpoint.md')
const CHECKPOINT_REL = 'docs/checkpoints/active-subaru-checkpoint.md'
const REPO_AGENT_PATH = path.resolve(process.cwd(), '.agents', 'subaru.md')
const GLOBAL_AGENT_PATH = path.join(os.homedir(), '.config', 'opencode', 'agent', 'subaru.md')

interface Flags {
  title?: string
  steps?: number
  governance?: string
  force?: boolean
  noPull?: boolean
}

function fail(message: string): never {
  console.error(`✗ ${message}`)
  process.exit(1)
}

function git(args: string[]): string {
  const result = spawnSync('git', args, { encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`git ${args[0]} failed: ${(result.stderr || result.stdout).toString().trim()}`)
  }
  return (result.stdout || '').toString().trim()
}

function parseFlags(args: string[]): Flags {
  const flags: Flags = {}
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
      case '--no-pull':
        flags.noPull = true
        break
      default:
        fail(`Unknown flag: ${arg}`)
    }
  }
  return flags
}

function readCheckpoint(): ParsedCheckpoint | null {
  if (!existsSync(CHECKPOINT_PATH)) return null
  return parseFrontmatter(readFileSync(CHECKPOINT_PATH, 'utf8'))
}

function requireData(data: Partial<CheckpointData>): CheckpointData {
  if (!data.taskId || !data.title || !data.state || !data.totalSteps || !data.branch || !data.created || !data.updated) {
    fail('Checkpoint incompleto (falta frontmatter). Usa `subaru freeze` primero.')
  }
  return {
    taskId: data.taskId,
    title: data.title,
    state: data.state,
    currentStep: data.currentStep ?? 0,
    totalSteps: data.totalSteps,
    branch: data.branch,
    lastMachine: data.lastMachine ?? os.hostname(),
    governanceId: data.governanceId,
    created: data.created,
    updated: data.updated,
  }
}

function mustCheckpoint(taskId: string): ParsedCheckpoint {
  const checkpoint = readCheckpoint()
  if (!checkpoint) fail('No hay checkpoint. Ejecuta `subaru freeze` primero.')
  if (checkpoint.data.taskId !== taskId) {
    fail(`El checkpoint pertenece a otra misión: ${checkpoint.data.taskId ?? '(sin task_id)'}.`)
  }
  return checkpoint
}

function commitAndPush(state: SubaruState, taskId: string): void {
  const message = buildCommitMessage(taskId, state)
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'])
  git(['add', CHECKPOINT_REL])
  git(['commit', '-m', message])
  try {
    git(['push', 'origin', branch])
  } catch (err) {
    console.error(`  ⚠ Commit local OK pero el push falló: ${(err as Error).message}`)
    console.error(`  → Corre: git pull --rebase origin ${branch} && npx tsx workshop/subaru/cli.ts status`)
    process.exit(1)
  }
  console.log(`  ✓ Commit + push: ${message}`)
}

function printCheckpointSummary(data: Partial<CheckpointData>): void {
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

function cmdFreeze(args: string[]): void {
  const taskId = args[0]
  const flags = parseFlags(args.slice(1))
  if (!taskId || !flags.title || !flags.steps) {
    fail('Usage: subaru freeze <task-id> --title "<title>" --steps <n> [--governance <id>] [--force]')
  }

  const current = readCheckpoint()
  if (current) {
    const prevTask = current.data.taskId
    const prevState = current.data.state
    if (prevTask && prevTask !== taskId && prevState && prevState !== 'completed' && !flags.force) {
      fail(`Hay una misión activa ("${prevTask}", state: ${prevState}). Usa --force para sobrescribir.`)
    }
  }

  const now = new Date().toISOString()
  const data: CheckpointData = {
    taskId,
    title: flags.title,
    state: 'blueprint_ready',
    currentStep: 0,
    totalSteps: flags.steps,
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD']),
    lastMachine: os.hostname(),
    governanceId: flags.governance,
    created: current?.data.created ?? now,
    updated: now,
  }

  const body = current?.body ?? ''
  if (!body.trim()) {
    console.warn('  ⚠ El checkpoint no tiene cuerpo. Escribe el blueprint (plan atómico) en el archivo antes de continuar.')
  }

  writeFileSync(CHECKPOINT_PATH, serializeCheckpoint(data, body), 'utf8')
  console.log(`✓ Blueprint congelado: ${taskId} (${flags.steps} pasos)`)
  commitAndPush('blueprint_ready', taskId)
  console.log('  → Ahora implementa los pasos y marca avance con `subaru mark <id> <n>`.')
}

function cmdMark(args: string[]): void {
  const taskId = args[0]
  const stepArg = args[1]
  parseFlags(args.slice(2))
  if (!taskId || !stepArg) fail('Usage: subaru mark <task-id> <step>')

  const step = Number(stepArg)
  const checkpoint = mustCheckpoint(taskId)
  const data = requireData(checkpoint.data)
  if (data.state === 'completed') fail(`La misión ${taskId} ya está completada.`)
  if (!validateStep(step, data.totalSteps)) fail(`Paso ${step} fuera de rango (1..${data.totalSteps}).`)

  const updated: CheckpointData = {
    ...data,
    state: 'in_progress',
    currentStep: step,
    lastMachine: os.hostname(),
    updated: new Date().toISOString(),
  }
  const body = flipStepCheckbox(checkpoint.body, step)
  writeFileSync(CHECKPOINT_PATH, serializeCheckpoint(updated, body), 'utf8')
  console.log(`✓ Paso ${step}/${data.totalSteps} marcado`)
  commitAndPush('in_progress', taskId)
  console.log(`  → Siguiente: implementar paso ${step + 1} o ` +
    (step >= data.totalSteps ? 'finalizar con `subaru complete <id>`.' : `marcar con \`subaru mark ${taskId} ${step + 1}\`.`))
}

function cmdComplete(args: string[]): void {
  const taskId = args[0]
  parseFlags(args.slice(1))
  if (!taskId) fail('Usage: subaru complete <task-id>')

  const checkpoint = mustCheckpoint(taskId)
  const data = requireData(checkpoint.data)
  if (data.state === 'completed') {
    console.log(`✓ La misión ${taskId} ya estaba completada.`)
    return
  }

  const updated: CheckpointData = {
    ...data,
    state: 'completed',
    currentStep: data.totalSteps,
    lastMachine: os.hostname(),
    updated: new Date().toISOString(),
  }
  writeFileSync(CHECKPOINT_PATH, serializeCheckpoint(updated, checkpoint.body), 'utf8')
  console.log(`✓ Misión ${taskId} completada`)
  commitAndPush('completed', taskId)
}

function cmdStatus(): void {
  const checkpoint = readCheckpoint()
  if (!checkpoint) {
    console.log('No hay checkpoint en docs/checkpoints/active-subaru-checkpoint.md.')
    console.log('Inicia una misión con: npx tsx workshop/subaru/cli.ts freeze <id> --title "<t>" --steps <n>')
    return
  }
  printCheckpointSummary(checkpoint.data)
  if (checkpoint.data.state === 'completed') {
    console.log('  → Misión completada. Inicia una nueva con `subaru freeze`.')
  } else {
    const next = (checkpoint.data.currentStep ?? 0) + 1
    console.log(`  → Siguiente: ` +
      (next > (checkpoint.data.totalSteps ?? 0)
        ? `subaru complete ${checkpoint.data.taskId}`
        : `subaru mark ${checkpoint.data.taskId} ${next}`))
  }
}

function cmdRevive(args: string[]): void {
  const flags = parseFlags(args)
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'])
  if (!flags.noPull) {
    console.log(`→ git pull --rebase origin ${branch}`)
    try {
      git(['pull', '--rebase', 'origin', branch])
    } catch (err) {
      console.error(`  ⚠ Pull falló: ${(err as Error).message}`)
      process.exit(1)
    }
  }

  const checkpoint = readCheckpoint()
  if (!checkpoint) {
    console.log('No hay checkpoint. Esta máquina no tiene misión que retomar.')
    return
  }
  console.log('── RESURRECCIÓN SUBARU ─────────────────────────────')
  printCheckpointSummary(checkpoint.data)
  const data = checkpoint.data
  if (data.state === 'completed') {
    console.log('  → Esta misión ya se completó en otra máquina. No hay nada que retomar.')
    return
  }
  const step = data.currentStep ?? 0
  const total = data.totalSteps ?? 0
  if (step >= total) {
    console.log(`  → Plan en docs/checkpoints/active-subaru-checkpoint.md`)
    console.log(`  → Siguiente: subaru complete ${data.taskId}`)
  } else {
    console.log(`  → Plan en docs/checkpoints/active-subaru-checkpoint.md`)
    console.log(`  → Retomar en Paso ${step + 1}: implementar y marcar con: npx tsx workshop/subaru/cli.ts mark ${data.taskId} ${step + 1}`)
  }
}

function cmdBootstrap(): void {
  console.log('── SUBARU BOOTSTRAP ────────────────────────────────')
  const nodeVersion = spawnSync('node', ['--version'], { encoding: 'utf8' })
  console.log(`  Node:      ${nodeVersion.stdout.trim() || '(no detectado)'}`)
  console.log(`  Repo:      ${process.cwd()}`)
  try {
    const remote = git(['remote', '-v']).split(/\r?\n/)[0] || '(sin remotes)'
    console.log(`  Remote:    ${remote}`)
  } catch {
    console.log('  Remote:    (sin remotes configurados)')
  }

  if (!existsSync(REPO_AGENT_PATH)) {
    console.warn('  ⚠ Falta el espejo .agents/subaru.md en el repo. No se puede restaurar el agente.')
  } else {
    if (existsSync(GLOBAL_AGENT_PATH)) {
      console.log(`  ✓ Agente global ya existe: ${GLOBAL_AGENT_PATH}`)
    } else {
      mkdirSync(path.dirname(GLOBAL_AGENT_PATH), { recursive: true })
      copyFileSync(REPO_AGENT_PATH, GLOBAL_AGENT_PATH)
      console.log(`  ✓ Agente global restaurado desde .agents/subaru.md`)
      console.log('  → Reinicia opencode para que cargue el agente restaurado.')
    }
  }

  console.log('  → Listo. Ejecuta: npx tsx workshop/subaru/cli.ts revive')
}

function printHelp(): void {
  console.log(`
PROTOCOL SUBARU — Resurrección multi-máquina de tareas

USAGE:
  npx tsx workshop/subaru/cli.ts <command> [options]

COMMANDS:
  freeze <id> --title "<t>" --steps <n> [--governance <id>] [--force]
      Congela el blueprint (frontmatter + commit + push) DESPUÉS de la
      aprobación del concilio y ANTES de codificar. Commit: "subaru: checkpoint <id> - listo".
  mark <id> <step>
      Marca un paso completado (state in_progress, tick del checkbox) + commit/push.
  complete <id>
      Cierra la misión (state completed) + commit/push.
  revive [--no-pull]
      git pull --rebase + resumen del checkpoint + siguiente paso a retomar.
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

function main(): void {
  const command = process.argv[2]
  const args = process.argv.slice(3)

  switch (command) {
    case 'freeze':
      cmdFreeze(args)
      break
    case 'mark':
      cmdMark(args)
      break
    case 'complete':
      cmdComplete(args)
      break
    case 'revive':
      cmdRevive(args)
      break
    case 'status':
      cmdStatus()
      break
    case 'bootstrap':
      cmdBootstrap()
      break
    case 'help':
    case '--help':
    case '-h':
      printHelp()
      break
    case undefined:
      printHelp()
      break
    default:
      console.error(`Unknown command: ${command}`)
      printHelp()
      process.exit(1)
  }
}

main()
