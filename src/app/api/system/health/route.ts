import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { runHealthChecks, getLatestHealthReport } from '@/lib/system/health'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const refresh = searchParams.get('refresh') === '1'

  try {
    const { supabase, user } = await requireAuth()

    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle()

    const businessId = business?.id ?? null
    const admin = createAdminClient()

    if (refresh) {
      const report = await runHealthChecks({
        businessId,
        scope: 'dashboard',
        supabase,
        admin,
      })
      return NextResponse.json({ report })
    }

    const latest = await getLatestHealthReport(supabase, businessId)
    return NextResponse.json({ report: latest })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 },
    )
  }
}
