import { NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { handleApiError } from '@/lib/api-error'
import { reconnectBridgeSession, isWhatsAppBridgeEnabled } from '@/lib/baileys/bridge'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    await requirePlatformOwner()

    if (!isWhatsAppBridgeEnabled()) {
      return NextResponse.json(
        { error: 'WhatsApp bridge no esta habilitado' },
        { status: 503 }
      )
    }

    const { businessId } = await request.json()
    if (!businessId || typeof businessId !== 'string') {
      return NextResponse.json({ error: 'businessId requerido' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const { data: business } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('id', businessId)
      .maybeSingle()

    if (!business) {
      return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 })
    }

    const status = await reconnectBridgeSession(businessId)

    return NextResponse.json({
      success: true,
      businessName: business.name,
      status: status.status,
      phone: status.phone,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
