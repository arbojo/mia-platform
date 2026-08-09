import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import { InventoryError } from '@/lib/inventory/errors'
import { requireInventoryAdmin } from '@/lib/inventory/admin-api'
import { assertInventoryHubEnabled } from '@/lib/inventory/licensing'
import { createInventoryAdmin } from '@/lib/inventory/db'
import { generateAiRestockNote } from '@/lib/inventory/ai'

export const runtime = 'nodejs'

const aiSchema = z.object({
  suggestion_id: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireInventoryAdmin(businessId)
    await assertInventoryHubEnabled(businessId!)

    const body = await req.json()
    const parsed = aiSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }

    const supabase = createInventoryAdmin()
    const { data: suggestion, error } = await supabase
      .from('restock_suggestions')
      .select('*')
      .eq('id', parsed.data.suggestion_id)
      .eq('business_id', businessId)
      .maybeSingle()

    if (error) {
      throw error
    }
    if (!suggestion) {
      throw new InventoryError('NOT_FOUND', 'Sugerencia no encontrada', 404)
    }

    const note = await generateAiRestockNote({
      businessId: businessId!,
      suggestionId: suggestion.id,
      productName: 'Producto',
      sku: null,
      currentQuantity: suggestion.current_quantity,
      threshold: suggestion.low_stock_threshold,
      suggestedQty: suggestion.suggested_qty,
      velocity7d: (suggestion.reason as { velocity7d?: number })?.velocity7d ?? 0,
      velocity30d: (suggestion.reason as { velocity30d?: number })?.velocity30d ?? 0,
      daysOut: (suggestion.reason as { days_out?: number | null })?.days_out ?? null,
    })

    return NextResponse.json({ note })
  } catch (error) {
    if (error instanceof InventoryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Inventory suggestions AI error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
