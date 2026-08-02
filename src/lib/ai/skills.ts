import { createAdminClient } from '@/lib/supabase/admin'
import type { SkillLevel } from '@/lib/ai/memory'

export interface SkillGrowth {
  skill_key: string
  skill_name: string
  current_level: number
  previous_level: number | null
  delta: number
  status: SkillLevel['status']
  evidence_count: number
  growth_trend: 'up' | 'down' | 'stable' | 'new'
}

export interface SkillsSnapshot {
  overall_level: number
  total_evidence: number
  mastered_count: number
  learning_count: number
  needs_practice_count: number
  not_started_count: number
  skills: SkillGrowth[]
  growth_summary: string
}

function getStatus(level: number): SkillLevel['status'] {
  if (level >= 90) return 'mastered'
  if (level >= 60) return 'learning'
  if (level >= 30) return 'needs_practice'
  return 'not_started'
}

function getGrowthTrend(current: number, previous: number | null): SkillGrowth['growth_trend'] {
  if (previous === null) return 'new'
  if (current > previous + 5) return 'up'
  if (current < previous - 5) return 'down'
  return 'stable'
}

function buildGrowthSummary(skills: SkillGrowth[]): string {
  const mastered = skills.filter((s) => s.status === 'mastered')
  const improving = skills.filter((s) => s.growth_trend === 'up')
  const declining = skills.filter((s) => s.growth_trend === 'down')

  if (mastered.length === skills.length) {
    return '¡He dominado todas mis habilidades! Estoy lista para cualquier situación.'
  }

  if (improving.length > 0) {
    return `Estoy mejorando en ${improving.map((s) => s.skill_name).join(', ')}. Cada día sé un poco más.`
  }

  if (mastered.length > 0) {
    return `Ya domino ${mastered.map((s) => s.skill_name).join(', ')}. Sigo aprendiendo las demás.`
  }

  if (declining.length > 0) {
    return `Necesito practicar más ${declining.map((s) => s.skill_name).join(', ')}. Voy a prestar más atención.`
  }

  return 'Estoy construyendo mis habilidades. Cada conversación me hace mejor.'
}

export async function getSkillsSnapshot(businessId: string): Promise<SkillsSnapshot> {
  const supabase = createAdminClient()

  const { data: currentSkills, error } = await supabase
    .from('mia_skills')
    .select('*')
    .eq('business_id', businessId)
    .order('level', { ascending: false })

  if (error) throw error

  const { data: previousSnapshot } = await supabase
    .from('readiness_snapshots')
    .select('metadata')
    .eq('business_id', businessId)
    .order('calculated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const previousSkills = (previousSnapshot?.metadata as Record<string, unknown> | undefined)?.skills as
    | Array<{ skill_key: string; level: number }>
    | undefined

  const previousMap = new Map<string, number>()
  if (previousSkills) {
    for (const ps of previousSkills) {
      previousMap.set(ps.skill_key, ps.level)
    }
  }

  const skills: SkillGrowth[] = (currentSkills ?? []).map((s) => {
    const previousLevel = previousMap.get(s.skill_key) ?? null
    return {
      skill_key: s.skill_key,
      skill_name: s.skill_name,
      current_level: s.level,
      previous_level: previousLevel,
      delta: previousLevel !== null ? s.level - previousLevel : 0,
      status: getStatus(s.level),
      evidence_count: s.evidence_count,
      growth_trend: getGrowthTrend(s.level, previousLevel),
    }
  })

  const totalEvidence = skills.reduce((sum, s) => sum + s.evidence_count, 0)
  const overallLevel = skills.length > 0
    ? Math.round(skills.reduce((sum, s) => sum + s.current_level, 0) / skills.length)
    : 0

  return {
    overall_level: overallLevel,
    total_evidence: totalEvidence,
    mastered_count: skills.filter((s) => s.status === 'mastered').length,
    learning_count: skills.filter((s) => s.status === 'learning').length,
    needs_practice_count: skills.filter((s) => s.status === 'needs_practice').length,
    not_started_count: skills.filter((s) => s.status === 'not_started').length,
    skills,
    growth_summary: buildGrowthSummary(skills),
  }
}

export async function getSkillGrowthHistory(
  businessId: string,
  skillKey: string,
  limit = 12
): Promise<Array<{ date: string; level: number }>> {
  const supabase = createAdminClient()

  const { data: snapshots } = await supabase
    .from('readiness_snapshots')
    .select('calculated_at, metadata')
    .eq('business_id', businessId)
    .order('calculated_at', { ascending: false })
    .limit(limit)

  if (!snapshots) return []

  return snapshots
    .map((s) => {
      const skills = (s.metadata as Record<string, unknown> | undefined)?.skills as
        | Array<{ skill_key: string; level: number }>
        | undefined
      const skill = skills?.find((sk) => sk.skill_key === skillKey)
      return {
        date: s.calculated_at,
        level: skill?.level ?? 0,
      }
    })
    .filter((s) => s.level > 0)
    .reverse()
}
