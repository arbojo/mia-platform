import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { config } from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'

config({ path: '.env.local' })

const TOKEN_COSTS = { 'gpt-4o-mini': { input: 0.15, output: 0.60 } }

export function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export function getOpenAI(): OpenAI {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

export function calculateCost(model: string, inputTokens: number, outputTokens: number): number {
  const costs = TOKEN_COSTS[model as keyof typeof TOKEN_COSTS] ?? { input: 0.15, output: 0.60 }
  return (inputTokens * costs.input + outputTokens * costs.output) / 1_000_000
}

export function now(): string {
  return new Date().toISOString()
}

export function elapsedMs(start: number): number {
  return Date.now() - start
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
}

export type OperationType = 'knowledge_extraction' | 'conversation' | 'evaluation' | 'mentor_mode' | 'report_generation'

export interface AiCallRecord {
  operationType: OperationType
  model: string
  inputTokens: number
  outputTokens: number
  cost: number
  durationMs: number
  businessId: string
  success: boolean
  error?: string
}

export interface PhaseMetrics {
  phaseName: string
  durationMs: number
  aiCalls: AiCallRecord[]
  dbQueries: Array<{ table: string; durationMs: number; rowsAffected: number }>
  failures: string[]
  data: Record<string, unknown>
}

export class MetricsCollector {
  phases: PhaseMetrics[] = []
  allAiCalls: AiCallRecord[] = []
  businessIdMap: Map<string, string> = new Map()
  assistantIdMap: Map<string, string> = new Map()

  setIds(businessName: string, bizId: string, asstId: string): void {
    this.businessIdMap.set(businessName, bizId)
    this.assistantIdMap.set(businessName, asstId)
  }

  getBizId(businessName: string): string | undefined {
    return this.businessIdMap.get(businessName)
  }

  getAsstId(businessName: string): string | undefined {
    return this.assistantIdMap.get(businessName)
  }

  startPhase(name: string): void {
    this.phases.push({
      phaseName: name,
      durationMs: 0,
      aiCalls: [],
      dbQueries: [],
      failures: [],
      data: {},
    })
  }

  currentPhase(): PhaseMetrics {
    return this.phases[this.phases.length - 1]
  }

  endPhase(): void {
    const phase = this.currentPhase()
    phase.durationMs = Date.now()
  }

  recordAiCall(call: AiCallRecord): void {
    this.currentPhase().aiCalls.push(call)
    this.allAiCalls.push(call)
  }

  recordDbQuery(table: string, durationMs: number, rowsAffected: number): void {
    this.currentPhase().dbQueries.push({ table, durationMs, rowsAffected })
  }

  recordFailure(error: string): void {
    this.currentPhase().failures.push(error)
  }

  recordData(key: string, value: unknown): void {
    this.currentPhase().data[key] = value
  }

  totalTokens(): { input: number; output: number } {
    return this.allAiCalls.reduce(
      (acc, c) => ({ input: acc.input + c.inputTokens, output: acc.output + c.outputTokens }),
      { input: 0, output: 0 }
    )
  }

  totalCost(): number {
    return this.allAiCalls.reduce((sum, c) => sum + c.cost, 0)
  }

  totalCalls(): number {
    return this.allAiCalls.length
  }

  failures(): string[] {
    return this.phases.flatMap((p) => p.failures)
  }
}

export function printProgress(phase: number, totalPhases: number, business: number, totalBusinesses: number, conv: number, totalConvs: number, metrics: { tokens: number; cost: number; failures: number }): void {
  process.stdout.write('\x1b[2J\x1b[H')
  console.log(`╔══════════════════════════════════════╗`)
  console.log(`║  MIA SCALE TEST — PROGRESS           ║`)
  console.log(`╠══════════════════════════════════════╣`)
  console.log(`║  Phase: ${phase}/${totalPhases}                              ║`)
  console.log(`║  Business: ${business}/${totalBusinesses}                          ║`)
  console.log(`║  Conversation: ${conv}/${totalConvs}                       ║`)
  console.log(`╠══════════════════════════════════════╣`)
  console.log(`║  Tokens consumed: ${metrics.tokens.toString().padStart(8)}          ║`)
  console.log(`║  Est. cost: $${metrics.cost.toFixed(4).padStart(8)}               ║`)
  console.log(`║  Failures: ${metrics.failures}                              ║`)
  console.log(`╚══════════════════════════════════════╝`)
}

const TRACKING_DIR = path.join(__dirname)

export function saveTrackingFile(businessIds: string[], mode: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filePath = path.join(TRACKING_DIR, `.test-run-${timestamp}.json`)
  fs.writeFileSync(filePath, JSON.stringify({ timestamp, mode, businessIds }, null, 2))
  return filePath
}

export function getLatestTrackingFile(): string | null {
  const files = fs.readdirSync(TRACKING_DIR).filter((f) => f.startsWith('.test-run-') && f.endsWith('.json'))
  if (files.length === 0) return null
  files.sort().reverse()
  return path.join(TRACKING_DIR, files[0])
}

export function loadTrackingFile(filePath: string): { businessIds: string[]; mode: string } {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}