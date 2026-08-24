import * as fs from 'node:fs'
import * as path from 'node:path'
import type {
  TaskManifest,
  GovernanceStatus,
  CouncilDecision,
  QualityGateResult,
  InvariantVerificationResult,
} from './types'
import { createTaskId } from './types'

export class WorkflowEngine {
  private readonly governanceDir: string
  private readonly tasksDir: string
  private readonly logDir: string

  constructor(baseDir: string = process.cwd()) {
    this.governanceDir = path.resolve(baseDir, '.governance')
    this.tasksDir = path.join(this.governanceDir, 'tasks')
    this.logDir = path.join(this.governanceDir, 'logs')
  }

  private ensureDirs(): void {
    for (const dir of [this.governanceDir, this.tasksDir, this.logDir]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }
  }
  public createManifest(
    title: string,
    description: string,
    scope: TaskManifest['scope'],
    classification: TaskManifest['classification']
  ): TaskManifest {
    this.ensureDirs()

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

    if (newStatus === 'completed') {
      this.assertCompletionRequirements(manifest)
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

  private assertCompletionRequirements(manifest: TaskManifest): void {
    const gateResults = manifest.qualityGateResults ?? []
    for (const gate of manifest.classification.qualityGates) {
      const result = gateResults.find((g) => g.gate === gate)
      if (!result) {
        throw new Error(
          `Cannot complete ${manifest.id}: required quality gate '${gate}' has no recorded result. ` +
          'Record it with `record-gate` before completing.'
        )
      }
      if (!result.passed) {
        throw new Error(
          `Cannot complete ${manifest.id}: required quality gate '${gate}' was recorded as FAIL.`
        )
      }
    }

    const invariantResults = manifest.invariantResults ?? []
    for (const invariantId of manifest.applicableInvariants ?? []) {
      const result = invariantResults.find((i) => i.invariant_id === invariantId)
      if (!result) {
        throw new Error(
          `Cannot complete ${manifest.id}: applicable invariant '${invariantId}' has no recorded result. ` +
          'Record it with `record-invariant` before completing.'
        )
      }
      if (result.status !== 'PASS') {
        throw new Error(
          `Cannot complete ${manifest.id}: invariant '${invariantId}' is ${result.status}. ` +
          'UNKNOWN != PASS: only PASS permits completion.'
        )
      }
    }
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
    if (!manifest.qualityGateResults) manifest.qualityGateResults = []
    manifest.qualityGateResults = manifest.qualityGateResults.filter((r) => r.gate !== result.gate)
    manifest.qualityGateResults.push(result)
    this.saveManifest(manifest)
    this.log(`QUALITY: ${manifest.id} — ${result.gate} → ${result.passed ? 'PASS' : 'FAIL'}`)
    return manifest
  }

  public addInvariantResult(manifestId: string, result: InvariantVerificationResult): TaskManifest {
    const manifest = this.loadManifest(manifestId)
    if (!manifest.invariantResults) manifest.invariantResults = []
    manifest.invariantResults = manifest.invariantResults.filter(
      (r) => r.invariant_id !== result.invariant_id
    )
    manifest.invariantResults.push(result)
    this.saveManifest(manifest)
    this.log(`INVARIANT: ${manifest.id} — ${result.invariant_id} → ${result.status}`)
    return manifest
  }

  public getManifest(manifestId: string): TaskManifest | null {
    const filePath = path.join(this.tasksDir, `${manifestId}.json`)
    if (!fs.existsSync(filePath)) return null
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  }

  public listManifests(status?: GovernanceStatus): TaskManifest[] {
    this.ensureDirs()
    const files = fs.readdirSync(this.tasksDir).filter((f) => f.endsWith('.json'))
    const manifests: TaskManifest[] = []

    for (const file of files) {
      const content = fs.readFileSync(path.join(this.tasksDir, file), 'utf-8')
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
    this.ensureDirs()
    fs.writeFileSync(
      path.join(this.tasksDir, `${manifest.id}.json`),
      JSON.stringify(manifest, null, 2),
      'utf-8'
    )
  }

  private loadManifest(manifestId: string): TaskManifest {
    const manifest = this.getManifest(manifestId)
    if (!manifest) {
      throw new Error(`Task manifest ${manifestId} not found in ${this.tasksDir}`)
    }
    return manifest
  }

  private log(message: string): void {
    this.ensureDirs()
    const timestamp = new Date().toISOString()
    const logLine = `[${timestamp}] ${message}\n`
    const logFile = path.join(this.logDir, `governance-${new Date().toISOString().slice(0, 10)}.log`)
    fs.appendFileSync(logFile, logLine, 'utf-8')
  }
}
