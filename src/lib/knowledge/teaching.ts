/**
 * Tipos y reglas compartidas del flujo de teaching (correcciones ->
 * aprendizaje aplicable).
 *
 * La capa de datos admite cinco `correction_type` (migración 009) pero el flujo
 * de revisión solo cubría tres. Estas reglas son la única fuente de verdad para
 * responder dos preguntas que antes vivían partidas entre la API y la UI:
 *
 *   1. ¿Qué texto se materializa al aprobar?  -> resolveTeachingContent()
 *   2. ¿En qué tabla aterriza?                 -> TEACHING_TARGET
 *
 * Se exportan desde aquí para que la bandeja (lo que el humano ve) y el approve
 * (lo que se escribe) no puedan discrepar.
 */

export const LEARNING_CORRECTION_TYPES = [
  'knowledge',
  'rule',
  'product',
  'instruction',
  'mistake_prevention',
] as const

export type LearningCorrectionType = (typeof LEARNING_CORRECTION_TYPES)[number]

/** Tabla/entidad donde aterriza el aprendizaje al aprobarse. */
export type TeachingTarget = 'knowledge_item' | 'sales_rule' | 'ai_instruction'

export type TeachingEvent = {
  correction_type: LearningCorrectionType
  category: string | null
  original_response: string | null
  corrected_response: string | null
  knowledge_change: Record<string, unknown> | null
}

/**
 * `product` y `mistake_prevention` no tienen respuesta corregida equivalente: son
 * reglas sobre cómo debe comportarse el bot ("no repitas el menu"), no una
 * respuesta mejor que la anterior. El texto vive en `knowledge_change.learning`,
 * que es donde la evidencia ya está trazada.
 * Priorizamos `corrected_response` para no romper las correcciones manuales.
 */
export function resolveTeachingContent(event: TeachingEvent): string | null {
  const direct = event.corrected_response?.trim()
  if (direct) return direct

  const learned = event.knowledge_change?.learning
  return typeof learned === 'string' && learned.trim() ? learned.trim() : null
}

export const TEACHING_TARGET: Record<LearningCorrectionType, TeachingTarget> = {
  knowledge: 'knowledge_item',
  rule: 'sales_rule',
  product: 'sales_rule',
  instruction: 'ai_instruction',
  mistake_prevention: 'ai_instruction',
}

const DEFAULT_RULE_CATEGORY: Record<LearningCorrectionType, string> = {
  knowledge: 'faq',
  rule: 'restrictions',
  product: 'product',
  instruction: 'instruction',
  mistake_prevention: 'restrictions',
}

export function resolveRuleCategory(type: LearningCorrectionType, category: string | null): string {
  return category ?? DEFAULT_RULE_CATEGORY[type]
}

export const TEACHING_TYPE_LABELS: Record<LearningCorrectionType, string> = {
  knowledge: '🧠 Conocimiento',
  rule: '📏 Regla',
  product: '🏷️ Producto',
  instruction: '⚙️ Instrucción',
  mistake_prevention: '🛡️ Prevención',
}

export const SEVERITY_LABELS: Record<string, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
}

export function isLearningCorrectionType(value: string): value is LearningCorrectionType {
  return (LEARNING_CORRECTION_TYPES as readonly string[]).includes(value)
}