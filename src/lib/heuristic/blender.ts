import { createAdminClient } from '@/lib/supabase/admin'
import type { BlendedPattern, ExperienceMemoryItem } from './types'

/**
 * Mezcla probabilística de patrones (Modelo C: 70% Global/Industria, 30% Negocio)
 * El negocio siempre tiene la última palabra sobre el texto de la respuesta.
 */
export async function getBlendedPatterns(
  businessId: string,
  industry: string,
  ratioGlobal = 0.70,
): Promise<BlendedPattern[]> {
  const supabase = createAdminClient()
  const ratioBusiness = 1 - ratioGlobal

  const [baseResult, bizResult] = await Promise.all([
    supabase
      .from('experience_memory')
      .select('*')
      .or(`scope.eq.global,and(scope.eq.industry,industry.eq.${industry})`),
    supabase
      .from('experience_memory')
      .select('*')
      .eq('business_id', businessId)
      .eq('scope', 'business'),
  ])

  const baseItems = (baseResult.data ?? []) as ExperienceMemoryItem[]
  const bizItems = (bizResult.data ?? []) as ExperienceMemoryItem[]

  const baseMap = new Map(baseItems.map((item) => [item.pattern_key, item]))
  const bizMap = new Map(bizItems.map((item) => [item.pattern_key, item]))

  const allKeys = new Set<string>([...baseMap.keys(), ...bizMap.keys()])
  const blended: BlendedPattern[] = []

  for (const key of allKeys) {
    const base = baseMap.get(key)
    const biz = bizMap.get(key)

    let finalResponse: string
    let blendedProbability: number

    if (base && biz) {
      blendedProbability =
        Number(base.conversion_probability) * ratioGlobal +
        Number(biz.conversion_probability) * ratioBusiness
      finalResponse = biz.suggested_response
    } else if (biz) {
      blendedProbability = Number(biz.conversion_probability)
      finalResponse = biz.suggested_response
    } else if (base) {
      blendedProbability = Number(base.conversion_probability)
      finalResponse = base.suggested_response
    } else {
      continue
    }

    blended.push({
      patternKey: key,
      customerObjection: biz?.customer_objection || base?.customer_objection || '',
      finalResponse,
      blendedProbability,
    })
  }

  return blended
}
