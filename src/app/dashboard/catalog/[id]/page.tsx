import { requirePageAuth } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import { ProductDetail } from '@/components/catalog/ProductDetail'
import { getCatalogAvailability } from '@/lib/inventory/stock'
import type { CatalogAvailability } from '@/lib/inventory/stock'

export default async function CatalogProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, user } = await requirePageAuth()

  const { data: business } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    redirect('/dashboard/onboarding')
  }

  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .eq('business_id', business.id)
    .single()

  if (!product) {
    notFound()
  }

  const availability = await getCatalogAvailability(business.id, [product.id])
  const availabilityForProduct: CatalogAvailability | null = availability?.[product.id] ?? null

  return (
    <ProductDetail
      businessId={business.id}
      product={product}
      availability={availabilityForProduct}
    />
  )
}
