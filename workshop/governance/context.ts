export type ContextIntegrityStatus =
  | 'CONTEXT_PASS'
  | 'CONTEXT_RECOVERY_REQUIRED'
  | 'CONTEXT_HUMAN_REQUIRED'

export interface MissionContextSource {
  missionId?: string
  objective?: string
  scopeSummary?: string
  parentMissionId?: string | null
  resumePoint?: string | null
  pendingHumanDecisions?: string[]
  declaredScopePaths?: string[]
}

export interface CheckpointContextSource {
  taskId?: string
  state?: string
  currentStep?: number
  totalSteps?: number
}

export interface RegistryContextSource {
  invariantIds: string[]
}

export interface ContextReconstructionInput {
  manifest: MissionContextSource | null
  checkpoint: CheckpointContextSource | null
  registry: RegistryContextSource | null
  observedForeignPaths?: string[]
  declaredProtectedPaths?: string[]
}

export interface ContextReport {
  status: ContextIntegrityStatus
  missing: string[]
  ambiguities: string[]
  protectedPaths: string[]
  parentMissionId: string | null
  resumePoint: string | null
}

function hasValue(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

export function reconstructContext(input: ContextReconstructionInput): ContextReport {
  const missing: string[] = []
  const ambiguities: string[] = []
  const declared = new Set(input.declaredProtectedPaths ?? [])
  const protectedPaths = Array.from(
    new Set([...(input.observedForeignPaths ?? []), ...(input.declaredProtectedPaths ?? [])])
  ).sort()
  const undeclaredForeign = (input.observedForeignPaths ?? []).filter((p) => !declared.has(p))

  const parentMissionId =
    input.manifest?.parentMissionId != null && input.manifest.parentMissionId !== ''
      ? input.manifest.parentMissionId
      : null
  const resumePoint =
    input.manifest?.resumePoint != null && input.manifest.resumePoint !== ''
      ? input.manifest.resumePoint
      : null

  if (!input.manifest) {
    return {
      status: 'CONTEXT_HUMAN_REQUIRED',
      missing: ['governance manifest'],
      ambiguities,
      protectedPaths,
      parentMissionId,
      resumePoint,
    }
  }

  if (input.manifest.missionId && input.checkpoint?.taskId) {
    if (input.manifest.missionId !== input.checkpoint.taskId) {
      ambiguities.push(
        `manifest mission '${input.manifest.missionId}' contradicts checkpoint task '${input.checkpoint.taskId}'`
      )
    }
  }

  if (!hasValue(input.manifest.objective)) missing.push('manifest objective')
  if (!hasValue(input.manifest.scopeSummary)) missing.push('manifest scope')
  if (!input.checkpoint) missing.push('subaru checkpoint')
  else if (typeof input.checkpoint.currentStep !== 'number' || !input.checkpoint.state) {
    missing.push('subaru checkpoint progress fields')
  }
  if (!input.registry || input.registry.invariantIds.length === 0) {
    missing.push('invariant registry')
  }

  let status: ContextIntegrityStatus
  if (ambiguities.length > 0 || undeclaredForeign.length > 0) {
    status = 'CONTEXT_HUMAN_REQUIRED'
  } else if (
    missing.includes('manifest objective') ||
    missing.includes('manifest scope') ||
    missing.length === 0
  ) {
    status = missing.length === 0 ? 'CONTEXT_PASS' : 'CONTEXT_RECOVERY_REQUIRED'
  } else {
    status = 'CONTEXT_RECOVERY_REQUIRED'
  }

  return { status, missing, ambiguities, protectedPaths, parentMissionId, resumePoint }
}
