import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export class GovernanceViolationError extends Error {
  constructor(
    readonly reason: string,
  ) {
    super(`governance precondition failed: ${reason}`)
    this.name = 'GovernanceViolationError'
  }
}

export interface GovernanceChecker {
  assertApproved(taskId: string): void
}

interface ManifestShape {
  status?: unknown
}

export class FileGovernanceChecker implements GovernanceChecker {
  constructor(
    private readonly repoRoot: string = process.cwd(),
  ) {}

  assertApproved(taskId: string): void {
    const manifestPath = join(this.repoRoot, '.governance', 'tasks', `${taskId}.json`)
    if (!existsSync(manifestPath)) {
      throw new GovernanceViolationError(`manifest missing for ${taskId}: ${manifestPath}`)
    }
    let manifest: ManifestShape
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as ManifestShape
    } catch {
      throw new GovernanceViolationError(`manifest malformed (invalid JSON): ${manifestPath}`)
    }
    if (manifest === null || typeof manifest !== 'object' || typeof manifest.status !== 'string') {
      throw new GovernanceViolationError(`manifest malformed (missing string status): ${manifestPath}`)
    }
    if (manifest.status === 'rejected') {
      throw new GovernanceViolationError(`manifest rejected: ${taskId}`)
    }
    if (manifest.status !== 'approved') {
      throw new GovernanceViolationError(`manifest ${manifest.status}: ${taskId}`)
    }
  }
}
