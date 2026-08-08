import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import { DeliveryError } from '@/lib/delivery/errors'
import { requireDeliveryAdmin } from '@/lib/delivery/admin-api'
import { assertDeliveryHubEnabled } from '@/lib/delivery/licensing'
import { createDeliveryAdmin } from '@/lib/delivery/db'

export const runtime = 'nodejs'

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  phone: z.string().max(40).nullable().optional(),
  vehicle: z.string().max(100).nullable().optional(),
  status: z.enum(['active', 'inactive', 'busy']).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireDeliveryAdmin(businessId)
    await assertDeliveryHubEnabled(businessId!)

    const { id } = await params
    const body = await req.json()
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Solicitud inválida' }, { status: 400 })
    }

    const supabase = createDeliveryAdmin()
    const patch: Record<string, unknown> = {
      ...parsed.data,
      name: parsed.data.name?.trim(),
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('drivers')
      .update(patch)
      .eq('id', id)
      .eq('business_id', businessId)
      .select('id, business_id, sequential_number, name, phone, vehicle, status, created_at, updated_at')
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ driver: data })
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Delivery drivers PATCH error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const businessId = new URL(req.url).searchParams.get('business_id')
    await requireDeliveryAdmin(businessId)
    await assertDeliveryHubEnabled(businessId!)

    const { id } = await params
    const supabase = createDeliveryAdmin()

    const { data: activeRoute } = await supabase
      .from('routes')
      .select('id')
      .eq('driver_id', id)
      .eq('business_id', businessId)
      .neq('status', 'closed')
      .limit(1)
      .maybeSingle()

    if (activeRoute) {
      throw new DeliveryError('CONFLICT', 'No se puede eliminar un repartidor con rutas abiertas', 409)
    }

    const { error } = await supabase
      .from('drivers')
      .delete()
      .eq('id', id)
      .eq('business_id', businessId)

    if (error) {
      throw error
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof DeliveryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Delivery drivers DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
