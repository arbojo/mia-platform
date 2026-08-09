import { NextResponse, type NextRequest } from 'next/server'
import { InventoryError } from '@/lib/inventory/errors'
import { requireInventoryAdmin } from '@/lib/inventory/admin-api'
import { assertInventoryHubEnabled } from '@/lib/inventory/licensing'
import { getStockOverview } from '@/lib/inventory/stock'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireInventoryAdmin(businessId)
    await assertInventoryHubEnabled(businessId!)

    const { items, totals } = await getStockOverview(businessId!)

    return NextResponse.json({ items, totals })
  } catch (error) {
    if (error instanceof InventoryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Inventory items GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
