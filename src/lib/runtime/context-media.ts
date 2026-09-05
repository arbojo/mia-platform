import { triggerMatches, intentMatchesTrigger, detectMediaIntent, normalizeText } from './media'
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

/**
 * Señal discriminadora truthful del estado de media (DEC-20260904 R5/R6).
 * Se deriva SIEMPRE del resultado real del runtime (scope/eligibility/
 * intent/claims), nunca de una inferencia posterior del LLM.
 */
export type MediaStatus =
  | 'MEDIA_UNAVAILABLE_FOR_PRODUCT'
  | 'MEDIA_REQUEST_NOT_RECOGNIZED'
  | 'MEDIA_SCOPE_AMBIGUOUS'
  | 'DISPATCHED'
  | 'NONE'

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
  /** Estado truthful de media (R5/R6): por qué se despachó o NO se despachó. */
  mediaStatus: MediaStatus
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
    mediaStatus: 'NONE',
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
      mediaStatus: decision.mediaStatus,
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
/**
 * R6 — solo clasificación truthful del no-dispatch: "me muestras / me enseñas
 * <producto>" es MEDIA_REQUEST según el vocabulario del contrato (§5.2:
 * mostrar/enseñar) aunque no sea palabra-media literal ni imperativo pronominal
 * de `detectMediaIntent` (R2). NO altera la selección R3/R4 ni habilita
 * dispatch; únicamente etiqueta con truthfulidad por qué no se despachó.
 */
function isShowMediaRequest(message: string): boolean {
  return /\bme\s+(?:muestras?|ensenas?)\b/.test(normalizeText(message))
}

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
      decision: { ...emptyMediaDecision(), explicitScope, mediaStatus: 'NONE', reason: 'no conversation' },
    }
  }

  if (!userMessage) {
    return {
      attachment: null,
      decision: { ...emptyMediaDecision(), explicitScope, mediaStatus: 'NONE', reason: 'empty message' },
    }
  }

  // C-1 / doc 24 §6: sin scope o scope ambiguo → nunca dispatch.
  if (scope.length === 0) {
    const reason =
      scopeSource === 'ambiguous' ? 'C-1 ambiguity: no explicit scope' : 'no active context'
    return {
      attachment: null,
      decision: {
        ...emptyMediaDecision(),
        explicitScope,
        mediaStatus: scopeSource === 'ambiguous' ? 'MEDIA_SCOPE_AMBIGUOUS' : 'NONE',
        reason,
      },
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
        mediaStatus: 'MEDIA_SCOPE_AMBIGUOUS',
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
    isResend,
  })
  const { eligible, pending, matches, blockedClaims, failedIds, pool } = idempotency

  if (!eligible) {
    // R6 (DEC-20260904): el estado truthful del no-dispatch depende de si el
    // mensaje contuvo una MEDIA_REQUEST o no, detectada a partir del resultado
    // real del runtime (intención), jamás del LLM.
    const mediaRequested = detectMediaIntent(userMessage) || isShowMediaRequest(userMessage)
    return {
      attachment: null,
      decision: {
        ...emptyMediaDecision(),
        explicitScope,
        scope,
        mediaStatus: mediaRequested
          ? 'MEDIA_UNAVAILABLE_FOR_PRODUCT'
          : 'MEDIA_REQUEST_NOT_RECOGNIZED',
        reason: 'no eligible asset in scope',
      },
    }
  }

  // Resend explícito (D2 bypass único): re-presentar el asset ya despachado.
  // R8: el destino se busca en `matches`, y si el mensaje no matcheó ningún
  // trigger (no se re-satisface la condición) se resuelve desde el pool del
  // scope. Idempotencia conversation × asset intacta (claim 'existing_hit').
  if (isResend && blockedClaims.length > 0) {
    // El resend explícito re-presenta el asset ya despachado aunque exista un
    // nuevo candidato pendiente (p. ej. un principal no reclamado en P2): la
    // petición "de nuevo"/pronominal manda sobre la selección de asset nuevo.
    const last = blockedClaims[0]
    const asset =
      matches.find((m) => m.id === last.knowledge_item_id) ??
      pool.find((m) => m.id === last.knowledge_item_id) ??
      null
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
          mediaStatus: 'NONE',
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
        mediaStatus: 'DISPATCHED',
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
            mediaStatus: 'NONE',
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
          mediaStatus: 'DISPATCHED',
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
        mediaStatus: 'NONE',
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
        mediaStatus: 'NONE',
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
        mediaStatus: 'NONE',
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
      mediaStatus: 'DISPATCHED',
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
  /** Assets del scope candidatos (para el destino del resend R8). */
  pool: KnowledgeItem[]
}

async function resolveScopedIdempotency(params: {
  supabase: SupabaseLike
  businessId: string
  conversationId: string
  scope: string[]
  userMessage: string
  intentTag?: string | null
  isResend?: boolean
}): Promise<ScopedIdempotency> {
  const { supabase, businessId, conversationId, scope, userMessage, intentTag, isResend } = params

  const { data: candidates } = await supabase
    .from('knowledge_items')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .not('image_url', 'is', null)
    // R1.3 (DEC-20260904): trigger_condition NULL/vacío = media incondicional
    // del producto; NO es requisito de candidatura. Se quita el filtro
    // `.not('trigger_condition', 'is', null)` que la dejaba muerta.
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  // DELTA POR SCOPE (P1-3): jamás se evalúan triggers contra assets de otro
  // producto. Genéricos (NULL) solo con scope único (doc 25 §4 / doc 24 §6).
  const uniqueScope = scope.length === 1 ? scope[0] : null
  const pool = (candidates ?? [])
    .filter(
      (item) =>
        (uniqueScope !== null && item.product_id === uniqueScope) ||
        (uniqueScope !== null && item.product_id === null)
    )
    // Determinismo (DEC-20260904 INV-MEDIA-014 / DEC-20260825): position ASC
    // NULLS LAST → created_at ASC → empate por identidad estable (uuid).
    .sort((a, b) => {
      const pa = a.position ?? Number.MAX_SAFE_INTEGER
      const pb = b.position ?? Number.MAX_SAFE_INTEGER
      if (pa !== pb) return pa - pb
      const ta = a.created_at ? Date.parse(a.created_at) : 0
      const tb = b.created_at ? Date.parse(b.created_at) : 0
      if (ta !== tb) return ta - tb
      return a.id.localeCompare(b.id)
    })

  // R1.3: un asset sin condición (NULL/vacío) es media incondicional. NUNCA
  // construye un trigger artificial (INV-MEDIA-004): solo define elegibilidad
  // como principal (R3-P2), no matchea condiciones.
  const hasCondition = (item: KnowledgeItem): boolean =>
    item.trigger_condition != null && item.trigger_condition.trim().length > 0

  // R3-P1: especializada por condición. La condición refina DENTRO del producto.
  const conditionMatches = pool.filter(
    (item) =>
      (hasCondition(item) && triggerMatches(userMessage, item.trigger_condition ?? '')) ||
      (hasCondition(item) &&
        intentTag &&
        intentMatchesTrigger(intentTag, item.trigger_condition ?? ''))
  )

  // R3-P2: principal. Incondicionales (NULL/vacío, R1.3) del scope; si el
  // producto no declara ninguna, su grupo de media propio (>=2 assets) provee
  // la "representativa" de menor orden (DEC-20260825: position ASC NULLS LAST
  // → created_at ASC). Un único asset condicionado NO es grupo (caso
  // Neurofeet): sin principal no se inventa una representativa (R4 / DP-1).
  const mediaIntent = detectMediaIntent(userMessage)
  const ownerAssets = pool.filter((item) => item.product_id === uniqueScope)
  const principalCandidates = pool.filter((item) => !hasCondition(item))
  if (principalCandidates.length === 0 && ownerAssets.length >= 2) {
    principalCandidates.push(ownerAssets[0])
  }
  const principals = mediaIntent ? principalCandidates : []

  // R3 orden normativo: especializada por condición PRIMERO; solo sin match de
  // condición se acude al principal por intención de media. Sin match y sin
  // intención → ninguna (R3-P3).
  const matches = conditionMatches.length > 0 ? conditionMatches : principals

  // R8: un resend explícito necesita conocer los claims de la conversación
  // aunque el mensaje NO matchee ningún trigger (no se re-satisface la
  // condición). Sin match y sin resend no hace falta leer claims.
  const needClaims = matches.length > 0 || Boolean(isResend)
  if (!needClaims) {
    return { eligible: false, pending: [], matches, blockedClaims: [], failedIds: new Set(), pool }
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

  const pending = matches.filter((item) => {
    const claim = claimsByItem.get(item.id)
    if (!claim) return true
    if (claim.state === 'failed') return false // pasa al recover path
    return false
  })

  const blocked: Array<{ knowledge_item_id: string; created_at?: string }> = []
  const failedIds = new Set<string>()

  // Datos de idempotencia de los assets MATCHED (semántica histórica).
  for (const item of matches) {
    const claim = claimsByItem.get(item.id)
    if (!claim) continue
    if (claim.state === 'failed') {
      failedIds.add(item.id)
      continue
    }
    blocked.push({ knowledge_item_id: item.id, created_at: claim.created_at ?? undefined })
  }

  // R8: sin match de trigger/intención, el destino del resend es el asset del
  // scope con claim previo (más reciente). Sigue validado por scope.
  if (matches.length === 0 && isResend) {
    for (const item of pool) {
      const claim = claimsByItem.get(item.id)
      if (!claim || claim.state === 'failed') continue
      blocked.push({ knowledge_item_id: item.id, created_at: claim.created_at ?? undefined })
    }
  }

  // El claim más reciente primero (para resend/acknowledge determinístico).
  blocked.sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0
    const tb = b.created_at ? Date.parse(b.created_at) : 0
    return tb - ta
  })

  // Sin match: solo procede (resend) si hay al menos un claim previo en scope.
  const eligible = matches.length > 0 || (Boolean(isResend) && blocked.length > 0)

  return { eligible, pending, matches, blockedClaims: blocked, failedIds, pool }
}

function toAttachment(item: KnowledgeItem): MediaAttachment {
  return {
    knowledgeItemId: item.id,
    imageUrl: item.image_url ?? '',
    mediaType: item.media_type ?? 'image',
  }
}