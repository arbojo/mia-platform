import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import { InventoryError } from '@/lib/inventory/errors'
import { requireInventoryAdmin } from '@/lib/inventory/admin-api'
import { assertInventoryHubEnabled } from '@/lib/inventory/licensing'
import { applyAdjustment } from '@/lib/inventory/adjustments'

export const runtime = 'nodejs'

const adjustmentSchema = z.object({
  product_id: z.string().min(1),
  delta: z.number().int(),
  movement_type: z.enum(['purchase', 'adjustment', 'restock', 'waste', 'return']).default('adjustment'),
  reason: z.string().max(300).optional(),
  expected_version: z.number().int().positive().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    const { userId } = await requireInventoryAdmin(businessId)
    await assertInventoryHubEnabled(businessId!)

    const body = await req.json()
    const parsed = adjustmentSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }

    const result = await applyAdjustment({
      businessId: businessId!,
      productId: parsed.data.product_id,
      delta: parsed.data.delta,
      movementType: parsed.data.movement_type,
      reason: parsed.data.reason ?? 'Ajuste manual',
      actorId: userId,
      expectedVersion: parsed.data.expected_version,
    })

    return NextResponse.json({ result })
  } catch (error) {
    if (error instanceof InventoryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Inventory adjustments POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
