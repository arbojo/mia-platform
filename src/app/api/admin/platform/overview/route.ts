import { NextResponse } from 'next/server'
import { requirePlatformOwner } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { handleApiError } from '@/lib/api-error'
import type { PlatformTenant } from '@/lib/platform/types'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await requirePlatformOwner()

    const supabase = createAdminClient()

    const [{ data: businesses, error: bizError }, { data: snapshots }, { data: events }] =
      await Promise.all([
        supabase.from('businesses').select('id, name, created_at, edition'),
        supabase
          .from('readiness_snapshots')
          .select('business_id, maturity_stage')
          .order('calculated_at', { ascending: false }),
        supabase
          .from('sales_events')
          .select('business_id, event_type')
          .in('event_type', ['SALE_WON', 'SALE_LOST']),
      ])

    if (bizError) throw bizError

    const latestStage = new Map<string, string>()
    for (const s of snapshots ?? []) {
      if (!latestStage.has(s.business_id)) {
        latestStage.set(s.business_id, s.maturity_stage ?? 'observation')
      }
    }

    const salesCounts = new Map<string, { won: number; lost: number }>()
    for (const e of events ?? []) {
      const existing = salesCounts.get(e.business_id) ?? { won: 0, lost: 0 }
      if (e.event_type === 'SALE_WON') existing.won++
      if (e.event_type === 'SALE_LOST') existing.lost++
      salesCounts.set(e.business_id, existing)
    }

    const tenants: PlatformTenant[] = (businesses ?? []).map((biz) => {
      const sales = salesCounts.get(biz.id) ?? { won: 0, lost: 0 }
      return {
        id: biz.id,
        name: biz.name,
        createdAt: biz.created_at,
        edition: biz.edition,
        maturityStage: latestStage.get(biz.id) ?? 'observation',
        salesWon: sales.won,
        salesLost: sales.lost,
      }
    })

    return NextResponse.json({ businesses: tenants })
  } catch (error) {
    return handleApiError(error)
  }
}
