import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

export async function GET() {
  try {
    const { supabase, user } = await requireAuth()

    const { data: businessIds, error: rpcError } = await supabase.rpc('get_user_business_ids')
    if (rpcError || !businessIds || businessIds.length === 0) {
      return NextResponse.json({ error: 'No se encontró ningún negocio para el usuario' }, { status: 404 })
    }

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const startOfWeek = new Date(startOfToday)
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay())

    const [{ data: todayEvents }, { data: weekEvents }, { data: topProducts }, { data: conversations }] =
      await Promise.all([
        supabase
          .from('sales_events')
          .select('event_type, amount')
          .in('business_id', businessIds)
          .gte('created_at', startOfToday.toISOString()),
        supabase
          .from('sales_events')
          .select('event_type, amount')
          .in('business_id', businessIds)
          .gte('created_at', startOfWeek.toISOString()),
        supabase
          .from('sales_events')
          .select('metadata, event_type')
          .in('business_id', businessIds)
          .eq('event_type', 'SALE_WON')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('conversations').select('outcome').eq('type', 'live'),
      ])

    const summarize = (rows: Array<{ event_type: string; amount: number | null }> | null) => {
      const sales = (rows ?? []).filter((r) => r.event_type === 'SALE_WON')
      const revenue = sales.reduce((sum, r) => sum + (r.amount ?? 0), 0)
      return { sales: sales.length, revenue }
    }

    const today = summarize(todayEvents)
    const week = summarize(weekEvents)

    const productCounts = new Map<string, number>()
    for (const row of topProducts ?? []) {
      const name = (row.metadata as Record<string, unknown> | null)?.product_name
      if (typeof name === 'string' && name) {
        productCounts.set(name, (productCounts.get(name) ?? 0) + 1)
      }
    }
    const topProductList = [...productCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))

    const total = conversations?.length ?? 0
    const sold = (conversations ?? []).filter((c) => c.outcome === 'sold').length
    const interested = (conversations ?? []).filter((c) => c.outcome === 'interested').length
    const conversion = total > 0 ? Number(((sold / total) * 100).toFixed(1)) : 0

    return NextResponse.json({
      today,
      week,
      topProducts: topProductList,
      pipeline: { total, sold, interested, conversion },
      generatedBy: user.id,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 },
    )
  }
}
