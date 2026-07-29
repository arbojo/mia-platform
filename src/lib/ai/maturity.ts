export enum MaturityStage {
  OBSERVATION = 'observation',
  UNDERSTANDING = 'understanding',
  MENTOR = 'mentor',
  ADVISOR = 'advisor',
  AUTONOMOUS = 'autonomous',
}

export interface MaturityResult {
  stage: MaturityStage
  readiness: {
    overall: number
    confidence: number
    preparation: number
    performance: number | null
  }
  thresholds: {
    nextStage: MaturityStage | null
    requirements: string[]
  }
}

interface ReadinessInput {
  overall: number
  confidence: number
  preparation: number
  performance: number | null
  mentorSessionsCompleted?: number
}

const THRESHOLDS: Array<{
  stage: MaturityStage
  conditions: (r: ReadinessInput) => boolean
  requirements: (r: ReadinessInput) => string[]
}> = [
  {
    stage: MaturityStage.AUTONOMOUS,
    conditions: () => false,
    requirements: () => ['Safety architecture not yet designed'],
  },
  {
    stage: MaturityStage.ADVISOR,
    conditions: (r) => r.overall >= 80 && r.confidence >= 70 && r.preparation >= 60 && (r.mentorSessionsCompleted ?? 0) >= 3,
    requirements: (r) => {
      const reqs: string[] = []
      if (r.overall < 80) reqs.push(`Overall readiness ≥ 80 (current: ${r.overall})`)
      if (r.confidence < 70) reqs.push(`Confidence ≥ 70 (current: ${r.confidence})`)
      if (r.preparation < 60) reqs.push(`Preparation ≥ 60 (current: ${r.preparation})`)
      if ((r.mentorSessionsCompleted ?? 0) < 3) reqs.push(`Complete ${3 - (r.mentorSessionsCompleted ?? 0)} more Mentor Mode sessions`)
      return reqs
    },
  },
  {
    stage: MaturityStage.MENTOR,
    conditions: (r) => r.overall >= 60 && r.confidence >= 50 && r.preparation >= 40,
    requirements: (r) => {
      const reqs: string[] = []
      if (r.overall < 60) reqs.push(`Overall readiness ≥ 60 (current: ${r.overall})`)
      if (r.confidence < 50) reqs.push(`Confidence ≥ 50 (current: ${r.confidence})`)
      if (r.preparation < 40) reqs.push(`Preparation ≥ 40 (current: ${r.preparation})`)
      return reqs
    },
  },
  {
    stage: MaturityStage.UNDERSTANDING,
    conditions: (r) => r.overall >= 20 && r.confidence >= 15,
    requirements: (r) => {
      const reqs: string[] = []
      if (r.overall < 20) reqs.push(`Overall readiness ≥ 20 (current: ${r.overall})`)
      if (r.confidence < 15) reqs.push(`Confidence ≥ 15 (current: ${r.confidence})`)
      return reqs
    },
  },
  {
    stage: MaturityStage.OBSERVATION,
    conditions: () => true,
    requirements: () => [],
  },
]

export function determineStage(readiness: ReadinessInput): MaturityResult {
  const matched = THRESHOLDS.find((t) => t.conditions(readiness))

  const stage = matched?.stage ?? MaturityStage.OBSERVATION

  const nextIndex = THRESHOLDS.findIndex(
    (t) => t.stage === stage
  )
  const nextStage = nextIndex > 0 ? THRESHOLDS[nextIndex - 1].stage : null

  const nextThreshold = nextStage
    ? THRESHOLDS.find((t) => t.stage === nextStage)
    : null

  return {
    stage,
    readiness: {
      overall: readiness.overall,
      confidence: readiness.confidence,
      preparation: readiness.preparation,
      performance: readiness.performance,
    },
    thresholds: {
      nextStage,
      requirements: nextThreshold?.requirements(readiness) ?? [],
    },
  }
}

export function getStageLabel(stage: MaturityStage): string {
  const labels: Record<MaturityStage, string> = {
    [MaturityStage.OBSERVATION]: 'Observation',
    [MaturityStage.UNDERSTANDING]: 'Understanding',
    [MaturityStage.MENTOR]: 'Mentor',
    [MaturityStage.ADVISOR]: 'Advisor',
    [MaturityStage.AUTONOMOUS]: 'Autonomous',
  }
  return labels[stage]
}

export function getStageDescription(stage: MaturityStage): string {
  const descriptions: Record<MaturityStage, string> = {
    [MaturityStage.OBSERVATION]: 'MIA is silently learning about your business. No proactive behavior yet.',
    [MaturityStage.UNDERSTANDING]: 'MIA is identifying patterns and expressing observations.',
    [MaturityStage.MENTOR]: 'MIA can participate in Reverse Training to discover business gaps.',
    [MaturityStage.ADVISOR]: 'MIA proactively suggests improvements and recommends actions.',
    [MaturityStage.AUTONOMOUS]: 'Future stage — requires additional safety architecture.',
  }
  return descriptions[stage]
}
