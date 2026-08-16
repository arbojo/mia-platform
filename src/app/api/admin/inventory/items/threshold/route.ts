import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import { InventoryError } from '@/lib/inventory/errors'
import { requireInventoryAdmin } from '@/lib/inventory/admin-api'
import { assertInventoryHubEnabled } from '@/lib/inventory/licensing'
import { createInventoryAdmin } from '@/lib/inventory/db'

export const runtime = 'nodejs'

const thresholdSchema = z.object({
  product_id: z.string().min(1),
  low_stock_threshold: z.number().int().min(0),
})

export async function PATCH(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    const { userId } = await requireInventoryAdmin(businessId)
    await assertInventoryHubEnabled(businessId!)

    const body = await req.json()
    const parsed = thresholdSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }

    const { product_id, low_stock_threshold } = parsed.data
    const supabase = createInventoryAdmin()

    const { data: bridge } = await supabase
      .from('asset_products')
      .select('asset_id')
      .eq('business_id', businessId)
      .eq('product_id', product_id)
      .maybeSingle()

    if (!bridge) {
      throw new InventoryError('NOT_FOUND', 'No existe stock para este producto', 404)
    }

    const assetId = bridge.asset_id as string

    const { data, error } = await supabase
      .from('assets')
      .update({ min_qty: low_stock_threshold, updated_at: new Date().toISOString() })
      .eq('business_id', businessId)
      .eq('id', assetId)
      .select('*')
      .maybeSingle()

    if (error) {
      throw error
    }

    if (!data) {
      throw new InventoryError('NOT_FOUND', 'No existe stock para este producto', 404)
    }

    await supabase.from('audit_log').insert({
      business_id: businessId,
      actor_type: 'user',
      actor_id: userId || null,
      action: 'set_threshold',
      entity: 'assets',
      entity_id: assetId,
      details: { product_id, low_stock_threshold },
    })

    return NextResponse.json({ item: data })
  } catch (error) {
    if (error instanceof InventoryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Inventory items PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
