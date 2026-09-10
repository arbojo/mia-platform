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
 *   - El explicit-scope del mensaje REEMPLAZA el contexto persistido (INV-3):
 *     los productos mencionados en el turno pasan a ser el active set
 *     (más-reciente-primero, dedup); los anteriores se descartan.
 *   - Menciones múltiples en el MISMO mensaje persisten como set multi [A,B]:
 *     el turno siguiente genérico cae en ambigüedad (C-1, sin dispatch media).
 *   - El scope de un mensaje es: explicit-scopes del propio mensaje si los
 *     hay; si no, el contexto único; si hay 2+ activos y ningún explicit →
 *     ambigüedad → C-1 (no dispatch de media).
 *
 * Staleness conocido (pre-INV-3): las conversaciones creadas antes de
 * 2026-09-08T01:41 UTC (deploy del replace INV-3) pueden tener
 * active_product_ids acumulado con varios productos. Es comportamiento
 * esperado: el scope se auto-corrige en la próxima mención explícita de
 * producto (REPLACE, INV-3). NO requiere limpieza manual de datos.
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
  /** Nombre canónico del catálogo por productId (B3: identidad del anchor). */
  names: Record<string, string>
}

/** Identidad de producto activo determinística para el anchor B3 (doc 30 §3). */
export interface ActiveProductIdentity {
  productId: string
  name: string
}

type SupabaseLike = ReturnType<typeof import('@/lib/supabase/admin').createAdminClient>

/** Fila del catálogo activo tal como la consulta canónica de scope la usa. */
export interface CatalogProduct {
  id: string
  name: string
  sku: string | null
}

/** Consulta canónica del catálogo activo (la MISMA que ya usaba detectExplicitScopes). */
async function fetchActiveProducts(
  supabase: SupabaseLike,
  businessId: string
): Promise<CatalogProduct[]> {
  const { data: products } = await supabase
    .from('products')
    .select('id, name, sku')
    .eq('business_id', businessId)
    .eq('is_active', true)
  return (products ?? []) as CatalogProduct[]
}

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

/**
 * Clasifica el error de persistencia de active_product_ids para decidir el
 * logging. Un fallo de escritura NO debe pasar desapercibido: el scope se
 * resuelve en memoria y la conversación sigue funcionando, pero la DB
 * conserva un estado stale hasta la próxima mención explícita.
 */
export function classifyScopePersistenceError(err: unknown): {
  kind: 'rls' | 'constraint' | 'data' | 'network' | 'unknown'
  code: string | null
  hint: string | null
} {
  const code = (err as { code?: string } | null)?.code ?? null
  const hint = (err as { hint?: string } | null)?.hint ?? null
  let kind: 'rls' | 'constraint' | 'data' | 'network' | 'unknown' = 'unknown'
  if (code) {
    if (code === '42501' || code === '42502' || code === '42503') kind = 'rls'
    else if (code.startsWith('23')) kind = 'constraint'
    else if (code.startsWith('22')) kind = 'data'
    else if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'ENOTFOUND') kind = 'network'
  }
  return { kind, code, hint }
}

/** Log visible/alertable de un fallo de persistencia de scope (no silencioso). */
export function logScopePersistenceFailure(params: {
  conversationId: string
  businessId: string
  attempted: string[]
  error: unknown
}): void {
  const { conversationId, businessId, attempted, error } = params
  const { kind, code, hint } = classifyScopePersistenceError(error)
  const context = `business=${businessId} conversation=${conversationId} attempted=[${attempted.join(', ')}]`

  // Cada tipo de error tiene su causa más probable y su acción sugerida.
  const guidance: Record<string, string> = {
    rls: 'Posible violación de RLS: usar el admin client para writes server-side (AGENTS.md §5.5).',
    constraint: `Constraint DB: ${hint ?? 'revisar integridad del dato'}.`,
    data: 'Tipo de dato inválido en active_product_ids (espera string[] de UUIDs).',
    network: 'Fallo de red hacia Supabase — reintentar más tarde.',
    unknown: 'Error no clasificado — revisar stack completo.',
  }

  console.error(
    `[context-scope][ALERT] Failed to persist active_product_ids (${kind}): ${context} — ${guidance[kind]}`,
    error
  )
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
  userMessage: string,
  catalog?: CatalogProduct[]
): Promise<ExplicitScopeHit[]> {
  const normalizedMessage = normalizeText(userMessage)
  if (!normalizedMessage) return []

  const products = catalog ?? (await fetchActiveProducts(supabase, businessId))

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

/** Dedup + orden más-reciente-primero. Para REPLACE (INV-3) el caller pasa current=[]; la unión no se usa. */
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
    return {
      activeProductIds: [],
      messageScope: [],
      explicit: [],
      source: 'none',
      names: {},
    }
  }

  const current = await loadActiveProductIds(supabase, conversationId)

  // B3: el catálogo canónico se consulta UNA vez y alimenta tanto la detección
  // de explicit-scope como el mapa de nombres del anchor (0 queries nuevas).
  const products = await fetchActiveProducts(supabase, businessId)
  const names: Record<string, string> = {}
  for (const product of products) {
    if (product.name) names[product.id] = product.name
  }

  const explicit = await detectExplicitScopes(supabase, businessId, userMessage, products)

  const landingHits: ExplicitScopeHit[] = []
  if (landingProductId) {
    const { data: product } = await supabase
      .from('products')
      .select('id, name')
      .eq('business_id', businessId)
      .eq('id', landingProductId)
      .eq('is_active', true)
      .maybeSingle()
    if (product) {
      if (product.name) names[product.id] = product.name
      landingHits.push({ productId: product.id, source: 'landing' })
    }
  }

  const explicitHits: ExplicitScopeHit[] = [...explicit]
  for (const hit of landingHits) {
    if (!explicitHits.some((h) => h.productId === hit.productId)) explicitHits.push(hit)
  }

  if (explicitHits.length > 0) {
    // INV-3: el explicit-scope del mensaje REEMPLAZA el contexto persistido
    // (no se acumula entre turnos). Menciones múltiples del MISMO turno se
    // mantienen como set multi en `next`.
    // Nota stale pre-INV-3: conversaciones anteriores a 2026-09-08T01:41 UTC
    // podían tener active_product_ids acumulado; la primera mención explícita
    // de producto en esta versión lo reemplaza por completo (auto-corrección,
    // sin limpieza manual).
    const next = orderActiveProducts([], explicitHits.map((h) => h.productId))
    const changed = next.length !== current.length || next.some((id, i) => id !== current[i])
    if (changed) {
      try {
        await persistActiveProductIds(supabase, conversationId, next)
      } catch (err) {
        // INV-3 hardening: NO tragar el error en silencio. El scope en memoria
        // sigue siendo `next` para este turno, pero la DB puede quedar stale.
        logScopePersistenceFailure({
          conversationId,
          businessId,
          attempted: next,
          error: err,
        })
      }
    }
    const onlyLanding = explicitHits.every((h) => h.source === 'landing')
    return {
      activeProductIds: next,
      messageScope: explicitHits.map((h) => h.productId),
      explicit: explicitHits,
      source: onlyLanding ? 'landing' : 'explicit',
      names,
    }
  }

  if (current.length === 1) {
    return {
      activeProductIds: current,
      messageScope: current,
      explicit: [],
      source: 'context',
      names,
    }
  }

  if (current.length > 1) {
    return {
      activeProductIds: current,
      messageScope: [],
      explicit: [],
      source: 'ambiguous',
      names,
    }
  }

  return { activeProductIds: [], messageScope: [], explicit: [], source: 'none', names }
}

/**
 * B3 — Identidad del producto activo para el anchor de generación (doc 30 §3).
 *
 * Devuelve la identidad SOLO cuando el scope de ESTE mensaje es un único
 * producto determinístico de la conversación (explicit o context):
 *   - ambiguous / none → null (comportamiento actual, sin guess).
 *   - landing → null: la página ya ancla con su propia nota de contexto en
 *     buildMasterPrompt (## Producto activo); evita doble anchor.
 *   - messageScope con 2+ productos (multi-explicit) → null (no es único).
 * El nombre proviene exclusivamente del catálogo canónico (names), nunca de
 * texto LLM, Knowledge ni de un fallback arbitrario.
 */
export function resolveActiveProductIdentity(
  scope: ScopeResolution | null
): ActiveProductIdentity | null {
  if (!scope) return null
  if (scope.source !== 'explicit' && scope.source !== 'context') return null
  if (scope.messageScope.length !== 1) return null
  const productId = scope.messageScope[0]
  const name = scope.names[productId]
  if (!productId || !name) return null
  return { productId, name }
}