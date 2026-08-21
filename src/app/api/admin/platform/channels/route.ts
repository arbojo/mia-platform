import { NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { handleApiError } from '@/lib/api-error'
import type { PlatformBridgeSession } from '@/lib/platform/types'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await requirePlatformOwner()

    const supabase = createAdminClient()

    const [{ data: sessions, error: sessError }, { data: businesses }] = await Promise.all([
      supabase
        .from('whatsapp_sessions')
        .select('business_id, status, phone, error_message, updated_at'),
      supabase.from('businesses').select('id, name'),
    ])

    if (sessError) throw sessError

    const bizMap = new Map((businesses ?? []).map((b) => [b.id, b.name]))

    const bridges: PlatformBridgeSession[] = (sessions ?? []).map((s) => ({
      businessId: s.business_id,
      businessName: bizMap.get(s.business_id) ?? 'Desconocido',
      status: s.status as PlatformBridgeSession['status'],
      phone: s.phone,
      errorMessage: s.error_message,
      updatedAt: s.updated_at,
    }))

    return NextResponse.json(bridges)
  } catch (error) {
    return handleApiError(error)
  }
}
