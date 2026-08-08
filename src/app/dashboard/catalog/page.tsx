import { requirePageAuth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CatalogGrid } from '@/components/catalog/CatalogGrid'
import type { Database } from '@/lib/types'

type Product = Database['public']['Tables']['products']['Row']

export interface CatalogProduct extends Product {
  mediaCount: number
  thumbnail: string | null
}

export default async function CatalogPage() {
  const { supabase, user } = await requirePageAuth()

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    redirect('/dashboard/onboarding')
  }

  const [productsResult, mediaResult] = await Promise.all([
    supabase
      .from('products')
      .select('*')
      .eq('business_id', business.id)
      .order('name', { ascending: true }),
    supabase
      .from('knowledge_items')
      .select('product_id, image_url, created_at')
      .eq('business_id', business.id)
      .not('image_url', 'is', null)
      .not('product_id', 'is', null)
      .order('created_at', { ascending: true }),
  ])

  const counts = new Map<string, { mediaCount: number; thumbnail: string | null }>()
  for (const item of mediaResult.data ?? []) {
    if (!item.product_id) continue
    const entry = counts.get(item.product_id) ?? { mediaCount: 0, thumbnail: null }
    entry.mediaCount += 1
    if (!entry.thumbnail && item.image_url) entry.thumbnail = item.image_url
    counts.set(item.product_id, entry)
  }

  const products: CatalogProduct[] = (productsResult.data ?? []).map((product) => {
    const media = counts.get(product.id)
    return {
      ...product,
      mediaCount: media?.mediaCount ?? 0,
      thumbnail: media?.thumbnail ?? null,
    }
  })

  return <CatalogGrid businessId={business.id} initialProducts={products} />
}
