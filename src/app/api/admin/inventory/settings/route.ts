import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import { InventoryError } from '@/lib/inventory/errors'
import { requireInventoryAdmin } from '@/lib/inventory/admin-api'
import { assertInventoryEditionAvailable } from '@/lib/inventory/licensing'
import { createInventoryAdmin } from '@/lib/inventory/db'

export const runtime = 'nodejs'

const settingsSchema = z.object({
  enabled: z.boolean().optional(),
  default_low_stock_threshold: z.number().int().min(0).optional(),
  lead_time_days: z.number().int().min(0).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireInventoryAdmin(businessId)
    await assertInventoryEditionAvailable(businessId!)

    const supabase = createInventoryAdmin()
    const { data, error } = await supabase
      .from('business_settings')
      .select('*')
      .eq('business_id', businessId)
      .maybeSingle()

    if (error) {
      throw error
    }

    return NextResponse.json({ settings: data ?? null })
  } catch (error) {
    if (error instanceof InventoryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Inventory settings GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    const { userId } = await requireInventoryAdmin(businessId)
    await assertInventoryEditionAvailable(businessId!)

    const body = await req.json()
    const parsed = settingsSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }

    const supabase = createInventoryAdmin()
    const patch: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() }

    const { data, error } = await supabase
      .from('business_settings')
      .upsert({ business_id: businessId, ...patch })
      .select('*')
      .single()

    if (error) {
      throw error
    }

    await supabase.from('audit_log').insert({
      business_id: businessId,
      actor_type: 'user',
      actor_id: userId || null,
      action: 'update_settings',
      entity: 'business_settings',
      entity_id: businessId,
      details: patch,
    })

    return NextResponse.json({ settings: data })
  } catch (error) {
    if (error instanceof InventoryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Inventory settings PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
