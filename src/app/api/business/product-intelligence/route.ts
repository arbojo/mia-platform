import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getProductIntelligence, getSingleProductIntelligence } from '@/lib/ai/product-intelligence'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const productId = searchParams.get('product_id')

  if (productId) {
    const intel = await getSingleProductIntelligence(business.id, productId)
    return NextResponse.json({ product: intel })
  }

  const summary = await getProductIntelligence(business.id)
  return NextResponse.json(summary)
}
