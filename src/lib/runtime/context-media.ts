import { triggerMatches, intentMatchesTrigger } from './media'
import { isSafeMediaUrl } from './media-guard'
import type { MediaAttachment } from './conditional-media'
import type { ScopeSource } from './context-scope'
import type { Database } from '@/lib/types'

/**
 * ─────────────────────────────────────────────────────────────────────────
 * P1-3 / P1-4 / P1-7 — Trigger evaluation dentro del scope + claims atómicos
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Reemplaza la evaluación global de triggers por una evaluación SCOPED:
 *   message → context/scope → eligibility → asset selection → claim atómico.
 *
 * Reglas contractuales (doc 25 §3/§4/§5, doc 24 §5/§6, C-1):
 *   - scope {}           → NO dispatch (sin contexto / ambigüedad C-1).
 *   - scope único        → assets de ESE producto + genéricos (product_id NULL).
 *   - scope múltiple     → NO dispatch (ambigüedad, sin ranking evidenciado).
 *   - trigger match solo se evalúa contra los assets del scope.
 *   - selección: position ASC, luego created_at ASC (doc 25 §5).
 *   - idempotencia: conversation × asset (D6), claim atómico UNIQUE
 *     (knowledge_item_id, conversation_id) con estado claimed/dispatched/failed.
 *   - CLAIMED ≠ DISPATCHED ≠ DELIVERED (doc 26 §1). delivered = Fase 2.
 */

type SupabaseLike = ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>
type KnowledgeItem = Database['public']['Tables']['knowledge_items']['Row']

export type MediaClaimState = 'claimed' | 'dispatched' | 'failed'

export interface ContextMediaDecision {
  /** Productos evaluados (messageScope del turno). */
  scope: string[]
  /** Cómo se estableció el scope del mensaje. */
  explicitScope: 'literal' | 'sku' | 'landing' | 'context' | 'none'
  /** Existió al menos un asset elegible para el scope + trigger. */
  eligible: boolean
  /** Asset seleccionado (claim) o re-presentado. */
  assetSelected: string | null
  /** Resultado de idempotencia. */
  claim: 'created' | 'existing_hit' | 'recovered' | 'not_applicable'
  /** dispatched: true = confirmado por runtime; false = no se envía; unknown = en curso. */
  dispatched: boolean | 'unknown'
  /** Phase 1: SIEMPRE unknown (D3). */
  delivered: 'unknown'
  /** Trazabilidad: por qué no se despachó (para logging P1-7). */
  reason: string | null
}

export interface ContextMediaResult {
  attachment: MediaAttachment | null
  decision: ContextMediaDecision
}

export interface ResolveContextMediaParams {
  businessId: string
  customerId?: string
  conversationId: string | null
  userMessage: string
  intentTag?: string | null
  scope: string[]
  scopeSource: ScopeSource
  explicitSource?: 'literal' | 'sku' | 'landing'
  isResend?: boolean
  /** Client inyectable para tests. Si se omite, se crea un admin client. */
  supabase?: SupabaseLike
}

export function emptyMediaDecision(): ContextMediaDecision {
  return {
    scope: [],
    explicitScope: 'none',
    eligible: false,
    assetSelected: null,
    claim: 'not_applicable',
    dispatched: false,
    delivered: 'unknown',
    reason: null,
  }
}

export function explicitScopeLabel(
  scopeSource: ScopeSource,
  explicitSource?: 'literal' | 'sku' | 'landing'
): ContextMediaDecision['explicitScope'] {
  if (scopeSource === 'explicit') return explicitSource ?? 'literal'
  if (scopeSource === 'landing') return 'landing'
  if (scopeSource === 'context') return 'context'
  return 'none'
}

/**
 * Marca el estado de un claim existente (P1-4). Usado por processCore para
 * reflejar el handoff al transport ('dispatched') o el fallo ('failed').
 */
export async function setMediaClaimState(
  supabase: SupabaseLike,
  conversationId: string,
  knowledgeItemId: string,
  state: MediaClaimState
): Promise<void> {
  if (!conversationId) return
  const { error } = await supabase
    .from('chat_media_dispatched')
    .update({ state })
    .eq('conversation_id', conversationId)
    .eq('knowledge_item_id', knowledgeItemId)
  if (error) {
    console.error(`[context-media] Failed to update claim state to ${state}:`, error)
  }
}

/**
 * P1-7 — Decision logging estructurado. NO es una segunda fuente de verdad.
 */
export function logMediaDecision(params: {
  businessId: string
  conversationId: string | null
  userMessage: string
  decision: ContextMediaDecision
}): void {
  const { businessId, conversationId, userMessage, decision } = params
  console.log(
    '[media-decision]',
    JSON.stringify({
      businessId,
      conversationId,
      messagePreview: userMessage.slice(0, 120),
      scope: decision.scope,
      explicitScope: decision.explicitScope,
      eligible: decision.eligible,
      assetSelected: decision.assetSelected,
      claim: decision.claim,
      dispatched: decision.dispatched,
      delivered: decision.delivered,
      reason: decision.reason,
    })
  )
}

/**
 * Motor de resolución de media con scope (P1-3) y claim atómico (P1-4).
 *
 * Orden normativo (doc 25 §1):
 *   CONTEXT/SCOPE → ELIGIBILITY → ASSET SELECTION → ATOMIC CLAIM → result
 * (el dispatch real lo ejecuta el adapter; processCore marca 'dispatched').
 */
export async function resolveContextMedia(
  params: ResolveContextMediaParams
): Promise<ContextMediaResult> {
  const {
    businessId,
    customerId,
    conversationId,
    userMessage,
    intentTag,
    scope,
    scopeSource,
    explicitSource,
    isResend = false,
    supabase: injectedSupabase,
  } = params

  const explicitScope = explicitScopeLabel(scopeSource, explicitSource)

  if (!conversationId) {
    return {
      attachment: null,
      decision: { ...emptyMediaDecision(), explicitScope, reason: 'no conversation' },
    }
  }

  if (!userMessage) {
    return {
      attachment: null,
      decision: { ...emptyMediaDecision(), explicitScope, reason: 'empty message' },
    }
  }

  // C-1 / doc 24 §6: sin scope o scope ambiguo → nunca dispatch.
  if (scope.length === 0) {
    const reason =
      scopeSource === 'ambiguous' ? 'C-1 ambiguity: no explicit scope' : 'no active context'
    return {
      attachment: null,
      decision: { ...emptyMediaDecision(), explicitScope, reason },
    }
  }

  // doc 24 §5: multi-scope no es reducible a un único asset sin ranking. NO dispatch.
  if (scope.length > 1) {
    return {
      attachment: null,
      decision: {
        ...emptyMediaDecision(),
        explicitScope,
        scope,
        reason: 'C-1 ambiguity: multi-scope without unique ranking',
      },
    }
  }

  const { createAdminClient } = await import('@/lib/supabase/admin')
  const supabase = injectedSupabase ?? createAdminClient()

  const idempotency = await resolveScopedIdempotency({
    supabase,
    businessId,
    conversationId,
    scope,
    userMessage,
    intentTag,
  })
  const { eligible, pending, matches, blockedClaims, failedIds } = idempotency

  if (!eligible) {
    return {
      attachment: null,
      decision: {
        ...emptyMediaDecision(),
        explicitScope,
        scope,
        reason: 'no eligible asset in scope',
      },
    }
  }

  // Resend explícito (D2 bypass único): re-presentar el asset ya despachado.
  if (isResend && pending.length === 0 && blockedClaims.length > 0) {
    const last = blockedClaims[0]
    const asset = matches.find((m) => m.id === last.knowledge_item_id) ?? null
    if (!asset || !isSafeMediaUrl(asset.image_url ?? '')) {
      return {
        attachment: null,
        decision: {
          ...emptyMediaDecision(),
          explicitScope,
          scope,
          eligible: true,
          assetSelected: last.knowledge_item_id,
          claim: 'existing_hit',
          reason: 'resend target unavailable or unsafe url',
        },
      }
    }
    return {
      attachment: toAttachment(asset),
      decision: {
        scope,
        explicitScope,
        eligible: true,
        assetSelected: asset.id,
        claim: 'existing_hit',
        dispatched: 'unknown',
        delivered: 'unknown',
        reason: null,
      },
    }
  }

  // D2 recovery: un asset fallido puede re-claimarse (re-envío del intento).
  // Se evalúa ANTES del hit de idempotencia: un asset 'failed' NO es un
  // existing_hit (doc 26 §2) — su re-intento debe recuperarse, no acusar hit.
  // Previamente este bloque estaba después del return de `pending.length === 0`
  // (dead code): con un único asset fallido pending quedaba vacío y el hit
  // ganaba, haciendo la recuperación inalcanzable.
  if (failedIds.size > 0) {
    const failedAsset = matches.find((m) => failedIds.has(m.id))
    if (failedAsset) {
      await setMediaClaimState(supabase, conversationId, failedAsset.id, 'claimed')
      const urlOk = isSafeMediaUrl(failedAsset.image_url ?? '')
      if (!urlOk) {
        return {
          attachment: null,
          decision: {
            ...emptyMediaDecision(),
            explicitScope,
            scope,
            eligible: true,
            assetSelected: failedAsset.id,
            claim: 'recovered',
            reason: 'recovered asset has unsafe url',
          },
        }
      }
      return {
        attachment: toAttachment(failedAsset),
        decision: {
          scope,
          explicitScope,
          eligible: true,
          assetSelected: failedAsset.id,
          claim: 'recovered',
          dispatched: 'unknown',
          delivered: 'unknown',
          reason: null,
        },
      }
    }
  }

  // Idempotency hit (petición repetida del mismo asset): acknowledge, sin re-envío.
  if (pending.length === 0) {
    const hitId = blockedClaims[0]?.knowledge_item_id ?? null
    return {
      attachment: null,
      decision: {
        ...emptyMediaDecision(),
        explicitScope,
        scope,
        eligible: true,
        assetSelected: hitId,
        claim: 'existing_hit',
        reason: 'idempotency hit: asset already claimed/dispatched',
      },
    }
  }

  const selected = pending[0]


  // Guard de URL (SSRF) ANTES del claim: un URL inseguro nunca se reclama.
  if (!isSafeMediaUrl(selected.image_url ?? '')) {
    console.warn(
      `[context-media] image_url no segura omitida (knowledge_item=${selected.id}): ${selected.image_url}`
    )
    return {
      attachment: null,
      decision: {
        ...emptyMediaDecision(),
        explicitScope,
        scope,
        eligible: true,
        assetSelected: selected.id,
        reason: 'unsafe media url',
      },
    }
  }

  // Reclamo atómico (P1-4): UNIQUE(knowledge_item_id, conversation_id). El
  // perdedor de una carrera degrada a existing_hit en vez de duplicar.
  const { data: claimed, error } = await supabase
    .from('chat_media_dispatched')
    .upsert(
      {
        business_id: businessId,
        conversation_id: conversationId,
        ...(customerId ? { customer_id: customerId } : {}),
        knowledge_item_id: selected.id,
        state: 'claimed' as MediaClaimState,
      },
      { onConflict: 'knowledge_item_id,conversation_id', ignoreDuplicates: true }
    )
    .select('knowledge_item_id')

  if (error) {
    console.error('[context-media] Failed to claim media:', error)
    throw error
  }

  if (!isResend && (!claimed || claimed.length === 0)) {
    return {
      attachment: null,
      decision: {
        ...emptyMediaDecision(),
        explicitScope,
        scope,
        eligible: true,
        assetSelected: selected.id,
        claim: 'existing_hit',
        reason: 'claim lost race (concurrent dispatch)',
      },
    }
  }

  return {
    attachment: toAttachment(selected),
    decision: {
      scope,
      explicitScope,
      eligible: true,
      assetSelected: selected.id,
      claim: 'created',
      dispatched: 'unknown',
      delivered: 'unknown',
      reason: null,
    },
  }
}

interface ScopedIdempotency {
  eligible: boolean
  pending: KnowledgeItem[]
  matches: KnowledgeItem[]
  blockedClaims: Array<{ knowledge_item_id: string; created_at?: string }>
  failedIds: Set<string>
}

async function resolveScopedIdempotency(params: {
  supabase: SupabaseLike
  businessId: string
  conversationId: string
  scope: string[]
  userMessage: string
  intentTag?: string | null
}): Promise<ScopedIdempotency> {
  const { supabase, businessId, conversationId, scope, userMessage, intentTag } = params

  const { data: candidates } = await supabase
    .from('knowledge_items')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .not('image_url', 'is', null)
    .not('trigger_condition', 'is', null)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  // DELTA POR SCOPE (P1-3): jamás se evalúan triggers contra assets de otro
  // producto. Genéricos (NULL) solo con scope único (doc 25 §4 / doc 24 §6).
  const uniqueScope = scope.length === 1 ? scope[0] : null
  const inScope = (candidates ?? []).filter(
    (item) =>
      (uniqueScope !== null && item.product_id === uniqueScope) ||
      (uniqueScope !== null && item.product_id === null)
  )

  const matches = inScope.filter(
    (item) =>
      (item.trigger_condition ? triggerMatches(userMessage, item.trigger_condition) : false) ||
      (intentTag && intentMatchesTrigger(intentTag, item.trigger_condition ?? ''))
  )

  if (matches.length === 0) {
    return { eligible: false, pending: [], matches: [], blockedClaims: [], failedIds: new Set() }
  }

  const { data: claims } = await supabase
    .from('chat_media_dispatched')
    .select('knowledge_item_id, state, created_at')
    .eq('conversation_id', conversationId)

  const claimsByItem = new Map<string, { state: string | null; created_at: string | null }>()
  for (const claim of claims ?? []) {
    if (!claimsByItem.has(claim.knowledge_item_id)) {
      claimsByItem.set(claim.knowledge_item_id, claim)
    }
  }

  const blocked: Array<{ knowledge_item_id: string; created_at?: string }> = []
  const failedIds = new Set<string>()
  const pending = matches.filter((item) => {
    const claim = claimsByItem.get(item.id)
    if (!claim) return true
    if (claim.state === 'failed') {
      failedIds.add(item.id)
      return false // pasa al recover path
    }
    blocked.push({ knowledge_item_id: item.id, created_at: claim.created_at ?? undefined })
    return false
  })

  // El claim más reciente primero (para resend/acknowledge determinístico).
  blocked.sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0
    const tb = b.created_at ? Date.parse(b.created_at) : 0
    return tb - ta
  })

  return { eligible: true, pending, matches, blockedClaims: blocked, failedIds }
}

function toAttachment(item: KnowledgeItem): MediaAttachment {
  return {
    knowledgeItemId: item.id,
    imageUrl: item.image_url ?? '',
    mediaType: item.media_type ?? 'image',
  }
}