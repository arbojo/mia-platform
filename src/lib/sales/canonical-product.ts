import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

/** Untyped admin client for RPCs not present in the generated Database type. */
function createUntypedAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * C4 — Canonical product resolver for CRITICAL persistence.
 *
 * Strict safe-fail hierarchy (ratified Council Loop 3):
 *   1. explicit product_id
 *   2. exact SKU within business (unique)
 *   3. exact normalized name IF unique
 *   4. ambiguity / no-match => null (NO PERSIST)
 *
 * NEVER uses ilike / substring / fuzzy matching for critical persistence.
 * Read-side UX resolvers (context-scope, resolveRecommendedProduct) must NOT
 * call this to persist; they keep their own scope inference.
 */
export async function resolveCanonicalProductId(input: {
  businessId: string
  // 1. explicit product_id (landing / pre-resolved)
  productId?: string | null
  // 2. exact SKU fallback
  sku?: string | null
  // 3. exact normalized name fallback (only when unique)
  name?: string | null
}): Promise<string | null> {
  const { businessId, productId, sku, name } = input
  if (!businessId) return null

  const admin = createAdminClient()

  // 1. explicit product_id — validated against the business.
  if (productId) {
    const { data } = await admin
      .from('products')
      .select('id')
      .eq('business_id', businessId)
      .eq('id', productId)
      .maybeSingle()
    return data?.id ?? null
  }

  // 2 & 3 — exact match delegated to the DB function (never via ilike).
  const { data: resolvedId } = await createUntypedAdmin().rpc('canonical_product_resolver', {
    p_business_id: businessId,
    p_product_id: null,
    p_sku: sku && sku.trim() ? sku.trim() : null,
    p_name: name && name.trim() ? name.trim() : null,
  })

  return (resolvedId as string | null) ?? null
}

/**
 * C4 — Accept product resolution; returns null on ambiguity/no-match so the
 * caller can refuse to persist (NO PERSIST).
 */
export async function resolveCanonicalOrFail(input: {
  businessId: string
  productId?: string | null
  sku?: string | null
  name?: string | null
}): Promise<string | null> {
  return resolveCanonicalProductId(input)
}