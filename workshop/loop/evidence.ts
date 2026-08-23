import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

export interface LoopEvidence {
  mission_id: string
  attempt: number
  worker: string
  model: string
  start_time: string
  end_time: string
  result: string
  session_id?: string
  gate_results?: Record<string, boolean>
  error_summary?: string
  checkpoint?: string
  next_action?: string
}

export function evidenceFilePath(dir: string, missionId: string): string {
  return path.join(dir, `${missionId}.jsonl`)
}

export function appendEvidence(dir: string, record: LoopEvidence): void {
  mkdirSync(dir, { recursive: true })
  appendFileSync(evidenceFilePath(dir, record.mission_id), `${JSON.stringify(record)}\n`, 'utf8')
}

export function lastSessionId(dir: string, missionId: string): string | undefined {
  const file = evidenceFilePath(dir, missionId)
  if (!existsSync(file)) return undefined
  const lines = readFileSync(file, 'utf8').trim().split('\n').reverse()
  for (const line of lines) {
    const parsed = JSON.parse(line) as Partial<LoopEvidence>
    if (parsed.session_id) return parsed.session_id
  }
  return undefined
}
