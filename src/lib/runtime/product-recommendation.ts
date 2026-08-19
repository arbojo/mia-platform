import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeText, triggerMatches, intentMatchesTrigger } from './media'
import { detectIntent } from './intents'
import type { ProductReference } from '@/lib/channels/types'
import type { Database } from '@/lib/types'

type Product = Database['public']['Tables']['products']['Row']

export interface ResolveRecommendedProductParams {
  businessId: string
  userMessage: string
  intentTag?: string | null
  productId?: string | null
}

export async function resolveRecommendedProduct(
  params: ResolveRecommendedProductParams
): Promise<ProductReference | null> {
  const { businessId, userMessage, intentTag, productId } = params
  const supabase = createAdminClient()

  // 1. Señal más fuerte: el cliente viene de una landing de producto.
  if (productId) {
    const { data: product } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .eq('id', productId)
      .maybeSingle()
    if (product) return buildProductReference(supabase, product)
    return null
  }

  // 2. Coincidencia de trigger en knowledge_items con producto asociado.
  const { data: items } = await supabase
    .from('knowledge_items')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .not('product_id', 'is', null)
    .not('trigger_condition', 'is', null)

  const matchedProductIds = [
    ...new Set(
      (items ?? []).flatMap((item) => {
        if (!item.product_id || !item.trigger_condition) return []
        if (triggerMatches(userMessage, item.trigger_condition)) return [item.product_id]
        if (intentTag && intentMatchesTrigger(intentTag, item.trigger_condition)) return [item.product_id]
        return []
      })
    ),
  ]

  if (matchedProductIds.length === 1) {
    const { data: product } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .eq('id', matchedProductIds[0])
      .eq('is_active', true)
      .maybeSingle()
    if (product) return buildProductReference(supabase, product)
    return null
  }
  if (matchedProductIds.length > 1) return null

  // 2b. Match por nombre de producto en el mensaje (ej. "información del Clean Nails").
  const normalizedMessage = normalizeText(userMessage)
  const { data: allProducts } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)

  const nameMatches = (allProducts ?? []).filter((p) => {
    const normalizedName = normalizeText(p.name)
    return normalizedName.length > 0 && normalizedMessage.includes(normalizedName)
  })

  if (nameMatches.length === 1) {
    return buildProductReference(supabase, nameMatches[0])
  }

  // 3. Fallback: intención de catálogo/precio sobre productos activos.
  const intent = intentTag ?? detectIntent(userMessage)
  if (intent === 'catalog' || intent === 'price') {
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (products && products.length === 1) {
      return buildProductReference(supabase, products[0])
    }
  }

  return null
}

async function buildProductReference(
  supabase: ReturnType<typeof createAdminClient>,
  product: Product
): Promise<ProductReference> {
  let imageUrl = product.image_url
  if (!imageUrl) {
    const { data: media } = await supabase
      .from('knowledge_items')
      .select('image_url')
      .eq('business_id', product.business_id)
      .eq('product_id', product.id)
      .eq('is_active', true)
      .not('image_url', 'is', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    imageUrl = media?.image_url ?? null
  }

  return {
    productId: product.id,
    name: product.name,
    price: product.price,
    imageUrl,
    description: product.description,
    benefits: product.benefits,
  }
}
