import { NextResponse } from 'next/server'
import { requirePageAuth } from '@/lib/auth'

export const runtime = 'nodejs'

type KnowledgeImpactRow = {
  knowledge_item_id: string
  question: string
  category: string | null
  conversations_used: number
  conversations_sold: number
  close_rate: number
}

export async function GET() {
  try {
    const { supabase, user } = await requirePageAuth()

    const { data: businesses } = await supabase
      .from('businesses')
      .select('id')
      .eq('owner_id', user.id)
      .limit(1)

    const businessId = businesses?.[0]?.id
    if (!businessId) {
      return NextResponse.json({ error: 'No business found' }, { status: 404 })
    }

    const { data, error } = await supabase.rpc('get_knowledge_sales_impact', {
      p_business_id: businessId,
    })

    if (error) {
      console.error('Knowledge impact RPC error:', error)
      return NextResponse.json({ error: 'Error obteniendo el impacto del conocimiento' }, { status: 500 })
    }

    const rows = ((data ?? []) as KnowledgeImpactRow[]).filter((r) => r.conversations_used > 0)

    const summary = {
      totalKnowledge: rows.length,
      totalUsed: rows.reduce((s, r) => s + r.conversations_used, 0),
      totalSold: rows.reduce((s, r) => s + r.conversations_sold, 0),
      avgCloseRate: rows.length > 0 ? Number((rows.reduce((s, r) => s + r.close_rate, 0) / rows.length).toFixed(4)) : 0,
    }

    return NextResponse.json({ impact: rows, summary })
  } catch (error) {
    console.error('Knowledge impact error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}