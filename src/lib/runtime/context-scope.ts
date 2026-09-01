import { normalizeText } from './media'

/**
 * ─────────────────────────────────────────────────────────────────────────
 * P1-1 / P1-2 — Conversation-scoped context + explicit scope (docs 24, 25, D5)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * `active_product_ids[]` es el contexto comercial de la conversación:
 * lista ORDENADA más-reciente-primero de productos bajo consideración.
 *
 * Reglas contractuales (doc 24 §1–§7, doc 25 §2, D5):
 *   - Se muta SOLO por explicit-scope determinístico: nombre literal del
 *     producto o SKU (y productId landing/pre-resuelto). El LLM JAMÁS muta
 *     active_product_ids[].
 *   - Un trigger aislado / keyword genérico NO cambia el producto activo
 *     (INV-1).
 *   - TTL = vida de conversación (D1): sin decay intra-conversación en Fase 1.
 *   - Multi-producto = acumulación ordenada (doc 22 §3, INV-5): un producto
 *     nuevo se agrega al frente; los anteriores permanecen.
 *   - El scope de un mensaje es: explicit-scopes del propio mensaje si los
 *     hay; si no, el contexto único; si hay 2+ activos y ningún explicit →
 *     ambigüedad → C-1 (no dispatch de media).
 */

export type ExplicitScopeSource = 'literal' | 'sku' | 'landing'

export interface ExplicitScopeHit {
  productId: string
  source: ExplicitScopeSource
}

export type ScopeSource = 'explicit' | 'landing' | 'context' | 'ambiguous' | 'none'

export interface ScopeResolution {
  /** Contexto completo y persistido de la conversación (más-reciente-primero). */
  activeProductIds: string[]
  /** Scope aplicable a ESTE mensaje. [] = sin scope → sin media (C-1/none). */
  messageScope: string[]
  /** Hits de explicit-scope detectados en el mensaje (solo determinísticos). */
  explicit: ExplicitScopeHit[]
  /** Por qué tomó ese valor messageScope. */
  source: ScopeSource
}

type SupabaseLike = ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>

export async function loadActiveProductIds(
  supabase: SupabaseLike,
  conversationId: string
): Promise<string[]> {
  if (!conversationId) return []
  const { data } = await supabase
    .from('conversations')
    .select('active_product_ids')
    .eq('id', conversationId)
    .maybeSingle()
  return Array.isArray(data?.active_product_ids) ? data.active_product_ids : []
}

export async function persistActiveProductIds(
  supabase: SupabaseLike,
  conversationId: string,
  productIds: string[]
): Promise<void> {
  if (!conversationId) return
  await supabase
    .from('conversations')
    .update({ active_product_ids: productIds })
    .eq('id', conversationId)
}

function hasWord(normalizedMessage: string, word: string): boolean {
  if (!word) return false
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|\\s)${escaped}(?=\\s|$)`).test(normalizedMessage)
}

/**
 * Detecta el explicit-scope determinístico (D5): SOLO nombre literal o SKU.
 * Alias por LLM, anáfora o keywords jamás mutan scope — no se detectan acá.
 */
export async function detectExplicitScopes(
  supabase: SupabaseLike,
  businessId: string,
  userMessage: string
): Promise<ExplicitScopeHit[]> {
  const normalizedMessage = normalizeText(userMessage)
  if (!normalizedMessage) return []

  const { data: products } = await supabase
    .from('products')
    .select('id, name, sku')
    .eq('business_id', businessId)
    .eq('is_active', true)

  const hits: ExplicitScopeHit[] = []
  const seen = new Set<string>()

  // Mensaje compacto (sin espacios ni puntuación) para match robusto de SKU
  // (ej. "CN-001" → "cn001" dentro de "tengo cn-001" → "tengocn001").
  const compactMessage = normalizedMessage.replace(/\s/g, '')

  for (const product of products ?? []) {
    const compactSku = normalizeText(product.sku ?? '').replace(/\s/g, '')
    if (compactSku.length >= 2 && compactSku.length <= 32 && compactMessage.includes(compactSku)) {
      if (!seen.has(product.id)) {
        seen.add(product.id)
        hits.push({ productId: product.id, source: 'sku' })
      }
      continue
    }

    const name = normalizeText(product.name)
    if (!name) continue
    const matched = name.includes(' ')
      ? normalizedMessage.includes(name)
      : hasWord(normalizedMessage, name)

    if (matched && !seen.has(product.id)) {
      seen.add(product.id)
      hits.push({ productId: product.id, source: 'literal' })
    }
  }

  return hits
}

/** Merge de contexto con nuevos productos explícitos (más-reciente-primero, set). */
export function orderActiveProducts(current: string[], additions: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const id of [...additions, ...current]) {
    if (!seen.has(id)) {
      seen.add(id)
      result.push(id)
    }
  }
  return result
}

/**
 * Resuelve el scope de la conversación para un mensaje y persiste cualquier
 * mutación de contexto provocada por explicit-scope determinístico.
 */
export async function resolveScopeContext(params: {
  supabase: SupabaseLike
  businessId: string
  conversationId: string | null
  userMessage: string
  landingProductId?: string | null
}): Promise<ScopeResolution> {
  const { supabase, businessId, conversationId, userMessage, landingProductId } = params

  if (!conversationId || !userMessage) {
    return { activeProductIds: [], messageScope: [], explicit: [], source: 'none' }
  }

  const current = await loadActiveProductIds(supabase, conversationId)

  const explicit = await detectExplicitScopes(supabase, businessId, userMessage)

  const landingHits: ExplicitScopeHit[] = []
  if (landingProductId) {
    const { data: product } = await supabase
      .from('products')
      .select('id')
      .eq('business_id', businessId)
      .eq('id', landingProductId)
      .eq('is_active', true)
      .maybeSingle()
    if (product) landingHits.push({ productId: product.id, source: 'landing' })
  }

  const explicitHits: ExplicitScopeHit[] = [...explicit]
  for (const hit of landingHits) {
    if (!explicitHits.some((h) => h.productId === hit.productId)) explicitHits.push(hit)
  }

  if (explicitHits.length > 0) {
    const next = orderActiveProducts(
      current,
      explicitHits.map((h) => h.productId)
    )
    const changed = next.length !== current.length || next.some((id, i) => id !== current[i])
    if (changed) {
      try {
        await persistActiveProductIds(supabase, conversationId, next)
      } catch (err) {
        console.error('[context-scope] Failed to persist active_product_ids:', err)
      }
    }
    const onlyLanding = explicitHits.every((h) => h.source === 'landing')
    return {
      activeProductIds: next,
      messageScope: explicitHits.map((h) => h.productId),
      explicit: explicitHits,
      source: onlyLanding ? 'landing' : 'explicit',
    }
  }

  if (current.length === 1) {
    return { activeProductIds: current, messageScope: current, explicit: [], source: 'context' }
  }

  if (current.length > 1) {
    return { activeProductIds: current, messageScope: [], explicit: [], source: 'ambiguous' }
  }

  return { activeProductIds: [], messageScope: [], explicit: [], source: 'none' }
}