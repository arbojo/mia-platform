import { NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { handleApiError } from '@/lib/api-error'
import type { PlatformEdition } from '@/lib/platform/types'

export const runtime = 'nodejs'

const VALID_EDITIONS: PlatformEdition[] = ['evaluation', 'professional', 'enterprise', 'cloud']

export async function POST(request: Request) {
  try {
    await requirePlatformOwner()

    const { businessId, edition } = await request.json()

    if (!businessId || typeof businessId !== 'string') {
      return NextResponse.json({ error: 'businessId requerido' }, { status: 400 })
    }

    if (!edition || !VALID_EDITIONS.includes(edition)) {
      return NextResponse.json(
        { error: `edicion invalida. Valores permitidos: ${VALID_EDITIONS.join(', ')}` },
        { status: 400 }
      )
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

    const { error } = await supabase
      .from('businesses')
      .update({ edition })
      .eq('id', businessId)

    if (error) throw error

    return NextResponse.json({
      success: true,
      businessName: business.name,
      edition,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
