export interface SuggestionRecord {
  suggested_category: string | null
  suggested_question: string | null
  suggested_answer: string | null
  suggested_rule_content: string | null
}

export interface SuggestionEdits {
  category?: string
  question?: string
  answer?: string
  rule_content?: string
  image_url?: string | null
  trigger_condition?: string | null
  media_type?: string
}

export type SuggestionKind = 'knowledge' | 'rule'

export interface KnowledgeApproval {
  kind: 'knowledge'
  category: string
  question: string
  answer: string
  image_url: string | null
  trigger_condition: string | null
  media_type: string
}

export interface RuleApproval {
  kind: 'rule'
  category: string
  content: string
}

export type ApprovalPayload = KnowledgeApproval | RuleApproval

export type ResolutionResult =
  | { ok: true; payload: ApprovalPayload }
  | { ok: false; error: string }

const VALID_KNOWLEDGE_CATEGORIES = [
  'business_info',
  'faq',
  'objection',
  'process',
  'tip',
]

const VALID_RULE_CATEGORIES = [
  'zones',
  'payment',
  'schedule',
  'promotions',
  'restrictions',
  'escalation',
]

const VALID_MEDIA_TYPES = ['image', 'testimonial', 'flyer', 'other']

export function resolveSuggestionKind(
  suggestion: SuggestionRecord,
): SuggestionKind {
  if (suggestion.suggested_rule_content) return 'rule'
  return 'knowledge'
}

export function buildApprovalPayload(
  suggestion: SuggestionRecord,
  edits?: SuggestionEdits,
): ResolutionResult {
  const kind = resolveSuggestionKind(suggestion)

  if (edits?.category) {
    const valid =
      kind === 'rule' ? VALID_RULE_CATEGORIES : VALID_KNOWLEDGE_CATEGORIES
    if (!valid.includes(edits.category)) {
      return {
        ok: false,
        error: `Categoría inválida: "${edits.category}". Valores permitidos: ${valid.join(', ')}`,
      }
    }
  }

  if (edits?.media_type && !VALID_MEDIA_TYPES.includes(edits.media_type)) {
    return {
      ok: false,
      error: `Tipo de media inválido: "${edits.media_type}". Valores permitidos: ${VALID_MEDIA_TYPES.join(', ')}`,
    }
  }

  if (edits?.image_url && !edits.trigger_condition) {
    return {
      ok: false,
      error: 'Se requiere trigger_condition cuando se proporciona image_url',
    }
  }

  if (kind === 'rule') {
    const content =
      (edits?.rule_content ?? suggestion.suggested_rule_content) || null
    if (!content?.trim()) {
      return { ok: false, error: 'Se requiere contenido para la regla' }
    }
    return {
      ok: true,
      payload: {
        kind: 'rule',
        category: edits?.category ?? 'restrictions',
        content: content.trim(),
      },
    }
  }

  const question =
    (edits?.question ?? suggestion.suggested_question) || null
  const answer =
    (edits?.answer ?? suggestion.suggested_answer) || null

  if (!question?.trim() || !answer?.trim()) {
    return {
      ok: false,
      error: 'Se requiere pregunta y respuesta para el item de conocimiento',
    }
  }

  return {
    ok: true,
    payload: {
      kind: 'knowledge',
      category: edits?.category ?? suggestion.suggested_category ?? 'faq',
      question: question.trim(),
      answer: answer.trim(),
      image_url: edits?.image_url ?? null,
      trigger_condition: edits?.trigger_condition ?? null,
      media_type: edits?.media_type ?? 'other',
    },
  }
}
