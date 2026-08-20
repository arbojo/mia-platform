export type SubaruState = 'frozen' | 'in_progress' | 'completed' | 'blocked'

export const LEGACY_STATE_BLUEPRINT_READY = 'blueprint_ready'

export function normalizeState(state: unknown): SubaruState | undefined {
  if (state === LEGACY_STATE_BLUEPRINT_READY || state === 'frozen') return 'frozen'
  if (state === 'in_progress' || state === 'completed' || state === 'blocked') return state
  return undefined
}

export interface CheckpointData {
  taskId: string
  title: string
  state: SubaruState
  currentStep: number
  totalSteps: number
  branch: string
  lastMachine: string
  governanceId?: string
  created: string
  updated: string
}

export interface ParsedCheckpoint {
  data: Partial<CheckpointData>
  body: string
}

export interface StepCheckbox {
  step: number
  checked: boolean
  text: string
}

export interface StepAttributes {
  step: number
  objective: string
  files: string
  action: string
  dependency: string
  criterion: string
  gate: string
}

const STEP_ATTR_RE = /^  - (Objetivo|Archivos|Acción|Dependencia|Criterio de terminación|Gate\/verificación): ?(.*)$/

const SECRET_PATTERNS: { label: string; re: RegExp }[] = [
  { label: 'clave API sk-', re: /\bsk-[A-Za-z0-9_-]{6,}/g },
  { label: 'clave AWS AKIA', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { label: 'clave privada', re: /-----BEGIN (?:RSA|OPENSSH|EC) PRIVATE KEY-----/g },
  { label: 'password=', re: /\bpassword\s*[=:]\s*[^\s<]{4,}/gi },
  { label: 'token=', re: /\btoken\s*[=:]\s*[^\s<]{4,}/gi },
  { label: 'client_secret', re: /\bclient_secret\s*[=:]\s*[^\s<]{4,}/gi },
]

export function secretScan(body: string): string[] {
  const found: string[] = []
  for (const pattern of SECRET_PATTERNS) {
    pattern.re.lastIndex = 0
    if (pattern.re.test(body)) found.push(pattern.label)
  }
  return found
}

export function parseStepAttributes(body: string, step: number): StepAttributes | undefined {
  const lines = body.split(/\r?\n/)
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    const m = /^- \[([ x])\] \*\*Paso (\d+):/.exec(lines[i])
    if (m && Number(m[2]) === step) {
      start = i
      break
    }
  }
  if (start === -1) return undefined

  const attrs: Record<string, string> = {}
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i]
    if (/^- \[[ x]\] \*\*Paso /.test(line)) break
    const m = STEP_ATTR_RE.exec(line)
    if (m) attrs[m[1]] = m[2].trim()
  }

  return {
    step,
    objective: attrs['Objetivo'] ?? '',
    files: attrs['Archivos'] ?? '',
    action: attrs['Acción'] ?? '',
    dependency: attrs['Dependencia'] ?? '',
    criterion: attrs['Criterio de terminación'] ?? '',
    gate: attrs['Gate/verificación'] ?? '',
  }
}

export const REQUIRED_FIELDS: (keyof CheckpointData)[] = [
  'taskId',
  'title',
  'state',
  'totalSteps',
  'branch',
  'created',
  'updated',
]

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

const KEY_MAP: Record<string, keyof CheckpointData> = {
  task_id: 'taskId',
  title: 'title',
  state: 'state',
  current_step: 'currentStep',
  total_steps: 'totalSteps',
  branch: 'branch',
  last_machine: 'lastMachine',
  governance_id: 'governanceId',
  created: 'created',
  updated: 'updated',
}

const STATE_SUFFIX: Record<SubaruState, string> = {
  frozen: 'listo',
  in_progress: 'en-progreso',
  completed: 'completado',
  blocked: 'bloqueado',
}

export function parseFrontmatter(content: string): ParsedCheckpoint {
  const match = FRONTMATTER_RE.exec(content)
  if (!match) return { data: {}, body: content }

  const data: Partial<CheckpointData> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (!key || value === '') continue
    const field = KEY_MAP[key]
    if (!field) continue
    const record = data as unknown as Record<string, unknown>
    record[field] =
      field === 'state'
        ? normalizeState(value) ?? value
        : field === 'currentStep' || field === 'totalSteps'
          ? Number(value)
          : value
  }

  return { data, body: content.slice(match[0].length) }
}

export function serializeCheckpoint(data: CheckpointData, body: string): string {
  const lines = [
    '---',
    `task_id: ${data.taskId}`,
    `title: ${data.title}`,
    `state: ${data.state}`,
    `current_step: ${data.currentStep}`,
    `total_steps: ${data.totalSteps}`,
    `branch: ${data.branch}`,
    `last_machine: ${data.lastMachine}`,
  ]
  if (data.governanceId) lines.push(`governance_id: ${data.governanceId}`)
  lines.push(`created: ${data.created}`)
  lines.push(`updated: ${data.updated}`)
  lines.push('---')

  const trimmedBody = body.replace(/^\s*\n/, '')
  return `${lines.join('\n')}\n\n${trimmedBody}`
}

export function buildCommitMessage(taskId: string, state: SubaruState): string {
  return `subaru: checkpoint ${taskId} - ${STATE_SUFFIX[state]}`
}

export function validateStep(step: number, totalSteps: number): boolean {
  return Number.isInteger(step) && step >= 1 && step <= totalSteps
}

export function listStepCheckboxes(body: string): StepCheckbox[] {
  const out: StepCheckbox[] = []
  const re = /^- \[([ x])\] \*\*Paso (\d+)(?: ?\([^)]*\))?:/gm
  let match: RegExpExecArray | null
  while ((match = re.exec(body)) !== null) {
    out.push({ step: Number(match[2]), checked: match[1] === 'x', text: match[0] })
  }
  return out.sort((a, b) => a.step - b.step)
}

export function countCheckboxSteps(body: string): number {
  return listStepCheckboxes(body).length
}

export function countCheckedSteps(body: string): number {
  return listStepCheckboxes(body).filter((s) => s.checked).length
}

export function findStepCheckbox(body: string, step: number): StepCheckbox | undefined {
  return listStepCheckboxes(body).find((s) => s.step === step)
}

export function allStepsChecked(body: string): boolean {
  const boxes = listStepCheckboxes(body)
  return boxes.length > 0 && boxes.every((s) => s.checked)
}

export function missingSteps(body: string): number[] {
  return listStepCheckboxes(body).filter((s) => !s.checked).map((s) => s.step)
}

export function flipStepCheckbox(body: string, step: number): string {
  const box = findStepCheckbox(body, step)
  if (!box || box.checked) return body
  return body.replace(box.text, box.text.replace('[ ]', '[x]'))
}

export function scaffoldBlueprint(input: {
  taskId: string
  title: string
  governanceId?: string
  steps: number
}): string {
  const stepsLines: string[] = []
  for (let i = 1; i <= input.steps; i++) {
    stepsLines.push(`- [ ] **Paso ${i}:** (objetivo del paso ${i} — completar antes de implementar)`)
    stepsLines.push(`  - Objetivo: (qué logra el paso ${i})`)
    stepsLines.push('  - Archivos: (archivos afectados)')
    stepsLines.push('  - Acción: (acción esperada)')
    stepsLines.push('  - Dependencia: (paso previo que debe estar terminado, o "ninguna")')
    stepsLines.push('  - Criterio de terminación: (qué debe cumplirse para marcar el paso)')
    stepsLines.push('  - Gate/verificación: (gate que valida el paso)')
    stepsLines.push('')
  }

  const governance = input.governanceId ? `\n\nAprobación: ${input.governanceId}.` : ''
  return `# ⛩️ PROTOCOL SUBARU: Checkpoint Activo

## Mission

${input.title}${governance}

## Scope

- (archivos/módulos/dominios involucrados — completar)

## Non-goals

- (qué NO tocar — completar)

## Approved plan

Pasos atómicos aprobados por el Council:

${stepsLines.join('\n')}

## Current state

- Misión congelada (state: frozen). Pasos pendientes: 1..${input.steps}.

## Next action

Implementar el Paso 1 (el CLI actualiza esta sección con cada mark).

## Constraints

- (decisiones arquitectónicas, ADRs, reglas de governance, restricciones de seguridad — completar)

## Verification

- (gates obligatorios y estado de ejecución — completar)

## Recovery instructions

Tras un revive en cualquier máquina:
1. \`git pull --rebase origin main\`
2. \`npx tsx workshop/subaru/cli.ts revive\`
3. Leer el informe: misión, último paso completado, siguiente paso exacto.
4. Si \`DRIFT DETECTED\` aparece: NO continuar; resolver la contradicción.
5. Continuar el paso indicado y ejecutar \`subaru mark ${input.taskId} <n>\`.
6. Al final: \`subaru complete ${input.taskId}\`.
`
}

export function readSection(body: string, heading: string): string {
  const marker = `## ${heading}`
  const idx = body.indexOf(marker)
  if (idx === -1) return ''
  const rest = body.slice(idx + marker.length)
  const end = rest.search(/\n## /)
  const section = end === -1 ? rest : rest.slice(0, end)
  return section.trim()
}

export function readNextAction(body: string): string {
  return readSection(body, 'Next action')
}

export function updateSection(body: string, heading: string, content: string): string {
  const marker = `## ${heading}`
  const idx = body.indexOf(marker)
  if (idx === -1) return body
  const sectionEnd = body.indexOf('\n## ', idx + marker.length)
  const end = sectionEnd === -1 ? body.length : sectionEnd
  const section = body.slice(idx, end)
  const headerLine = section.slice(0, section.indexOf('\n'))
  const newSection = `${headerLine}\n\n${content}\n`
  return body.slice(0, idx) + newSection + body.slice(end)
}

export function updateNextAction(body: string, action: string): string {
  return updateSection(body, 'Next action', action)
}

export function missingFrontmatterFields(data: Partial<CheckpointData>): string[] {
  return REQUIRED_FIELDS.filter((field) => {
    const value = data[field]
    return value === undefined || value === null || value === ''
  })
}
