export type SubaruState = 'blueprint_ready' | 'in_progress' | 'completed' | 'blocked'

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
  blueprint_ready: 'listo',
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
    record[field] = field === 'currentStep' || field === 'totalSteps' ? Number(value) : value
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

export function flipStepCheckbox(body: string, step: number): string {
  const re = new RegExp(`^(\\- \\[ \\] \\*\\*Paso ${step}:)`, 'm')
  if (!re.test(body)) return body
  return body.replace(re, `- [x] **Paso ${step}:`)
}
