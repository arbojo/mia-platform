import * as fs from 'node:fs'
import * as path from 'node:path'
import type {
  TaskManifest,
  GovernanceStatus,
  CouncilDecision,
  QualityGateResult,
  AgentRole,
} from './types'
import { createTaskId } from './types'

const GOVERNANCE_DIR = path.resolve(process.cwd(), '.governance')
const TASKS_DIR = path.join(GOVERNANCE_DIR, 'tasks')
const LOG_DIR = path.join(GOVERNANCE_DIR, 'logs')

function ensureDirs(): void {
  for (const dir of [GOVERNANCE_DIR, TASKS_DIR, LOG_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
  }
}

export class WorkflowEngine {
  public createManifest(
    title: string,
    description: string,
    scope: TaskManifest['scope'],
    classification: TaskManifest['classification']
  ): TaskManifest {
    ensureDirs()

    const manifest: TaskManifest = {
      id: createTaskId(),
      title,
      description,
      scope,
      classification,
      status: classification.complexity === 'simple' ? 'approved' : 'awaiting_council',
      decisions: [],
      createdAt: new Date().toISOString(),
      classifiedAt: new Date().toISOString(),
    }

    if (classification.complexity === 'simple') {
      manifest.approvedAt = new Date().toISOString()
    }

    this.saveManifest(manifest)
    this.log(`CREATED: ${manifest.id} — ${classification.complexity.toUpperCase()} — ${title}`)

    return manifest
  }

  public transition(manifestId: string, newStatus: GovernanceStatus): TaskManifest {
    const manifest = this.loadManifest(manifestId)

    const valid = this.isValidTransition(manifest.status, newStatus)
    if (!valid) {
      throw new Error(
        `Invalid transition: ${manifest.status} → ${newStatus}. ` +
        `Valid targets: ${this.validNextStates(manifest.status).join(', ')}`
      )
    }

    manifest.status = newStatus

    switch (newStatus) {
      case 'approved':
        manifest.approvedAt = new Date().toISOString()
        break
      case 'in_progress':
        manifest.startedAt = new Date().toISOString()
        break
      case 'completed':
        manifest.completedAt = new Date().toISOString()
        break
      case 'rejected':
        manifest.rejectedAt = new Date().toISOString()
        break
    }

    this.saveManifest(manifest)
    this.log(`TRANSITION: ${manifest.id} → ${newStatus}`)

    return manifest
  }

  public addDecision(manifestId: string, decision: CouncilDecision): TaskManifest {
    const manifest = this.loadManifest(manifestId)
    manifest.decisions.push(decision)

    const allApproved = manifest.classification.requiredAgents.every((agent) =>
      manifest.decisions.some((d) => d.agentRole === agent && d.decision === 'approve')
    )

    const anyRejected = manifest.decisions.some((d) => d.decision === 'reject')

    if (anyRejected) {
      manifest.status = 'rejected'
      manifest.rejectedAt = new Date().toISOString()
    } else if (allApproved) {
      manifest.status = 'approved'
      manifest.approvedAt = new Date().toISOString()
    }

    this.saveManifest(manifest)
    this.log(`DECISION: ${manifest.id} — ${decision.agentRole} → ${decision.decision}`)

    return manifest
  }

  public addQualityResult(manifestId: string, result: QualityGateResult): TaskManifest {
    const manifest = this.loadManifest(manifestId)
    this.log(`QUALITY: ${manifest.id} — ${result.gate} → ${result.passed ? 'PASS' : 'FAIL'}`)
    return manifest
  }

  public getManifest(manifestId: string): TaskManifest | null {
    const filePath = path.join(TASKS_DIR, `${manifestId}.json`)
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  }

  public listManifests(status?: GovernanceStatus): TaskManifest[] {
    ensureDirs()
    const files = fs.readdirSync(TASKS_DIR).filter((f) => f.endsWith('.json'))
    const manifests: TaskManifest[] = []

    for (const file of files) {
      const content = fs.readFileSync(path.join(TASKS_DIR, file), 'utf-8')
      const manifest = JSON.parse(content) as TaskManifest
      if (!status || manifest.status === status) {
        manifests.push(manifest)
      }
    }

    return manifests.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  public findApprovedManifest(titleMatch: string): TaskManifest | null {
    const approved = this.listManifests('approved')
    return approved.find((m) => m.title.toLowerCase().includes(titleMatch.toLowerCase())) ?? null
  }

  public assertGovernance(manifestId?: string): TaskManifest {
    if (!manifestId) {
      const latestActive = this.listManifests().find(
        (m) => m.status === 'approved' || m.status === 'in_progress' || m.status === 'completed'
      )
      if (!latestActive) {
        throw new Error(
          'No approved task manifest found. ' +
          'Run `npx tsx workshop/governance/cli.ts classify` first to classify this task.'
        )
      }
      return latestActive
    }

    const manifest = this.getManifest(manifestId)
    if (!manifest) {
      throw new Error(`Task manifest ${manifestId} not found.`)
    }

    if (manifest.status !== 'approved' && manifest.status !== 'in_progress' && manifest.status !== 'completed') {
      throw new Error(
        `Task ${manifestId} is not approved (status: ${manifest.status}). ` +
        'Council review may be required before implementation.'
      )
    }

    return manifest
  }

  private isValidTransition(from: GovernanceStatus, to: GovernanceStatus): boolean {
    const allowed: Record<GovernanceStatus, GovernanceStatus[]> = {
      pending_classification: ['classified'],
      classified: ['awaiting_council', 'approved'],
      awaiting_council: ['council_in_progress', 'rejected'],
      council_in_progress: ['approved', 'rejected'],
      approved: ['in_progress', 'completed', 'rejected'],
      rejected: ['pending_classification'],
      in_progress: ['completed', 'rejected'],
      completed: [],
    }
    return allowed[from]?.includes(to) ?? false
  }

  private validNextStates(current: GovernanceStatus): GovernanceStatus[] {
    const allowed: Record<GovernanceStatus, GovernanceStatus[]> = {
      pending_classification: ['classified'],
      classified: ['awaiting_council', 'approved'],
      awaiting_council: ['council_in_progress', 'rejected'],
      council_in_progress: ['approved', 'rejected'],
      approved: ['in_progress', 'completed', 'rejected'],
      rejected: ['pending_classification'],
      in_progress: ['completed', 'rejected'],
      completed: [],
    }
    return allowed[current] ?? []
  }

  public saveManifest(manifest: TaskManifest): void {
    ensureDirs()
    fs.writeFileSync(
      path.join(TASKS_DIR, `${manifest.id}.json`),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    )
  }

  private loadManifest(manifestId: string): TaskManifest {
    const manifest = this.getManifest(manifestId)
    if (!manifest) {
      throw new Error(`Task manifest ${manifestId} not found in ${TASKS_DIR}`)
    }
    return manifest
  }

  private log(message: string): void {
    ensureDirs()
    const timestamp = new Date().toISOString()
    const logLine = `[${timestamp}] ${message}\n`
    const logFile = path.join(LOG_DIR, `governance-${new Date().toISOString().slice(0, 10)}.log`)
    fs.appendFileSync(logFile, logLine, 'utf-8')
  }
}
