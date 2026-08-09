import { NextResponse, type NextRequest } from 'next/server'
import { InventoryError } from '@/lib/inventory/errors'
import { requireInventoryAdmin } from '@/lib/inventory/admin-api'
import { assertInventoryHubEnabled } from '@/lib/inventory/licensing'
import { createInventoryAdmin } from '@/lib/inventory/db'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireInventoryAdmin(businessId)
    await assertInventoryHubEnabled(businessId!)

    const limit = Math.min(Number(new URL(req.url).searchParams.get('limit') ?? '100'), 500)

    const supabase = createInventoryAdmin()
    const { data: movements, error } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    const rows = (movements ?? []) as Array<{ product_id: string }>
    const productIds = [...new Set(rows.map((r) => r.product_id))]

    const productNames = new Map<string, string>()
    if (productIds.length > 0) {
      const pub = createAdminClient()
      const { data: products, error: productError } = await pub
        .from('products')
        .select('id, name, sku')
        .in('id', productIds)
      if (productError) throw productError
      for (const p of (products ?? []) as Array<{ id: string; name: string; sku: string | null }>) {
        productNames.set(p.id, p.name)
      }
    }

    const enriched = rows.map((row) => ({
      ...row,
      product_name: productNames.get(row.product_id) ?? 'Producto',
    }))

    return NextResponse.json({ movements: enriched })
  } catch (error) {
    if (error instanceof InventoryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Inventory movements GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
