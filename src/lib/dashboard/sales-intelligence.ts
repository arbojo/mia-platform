import { SupabaseClient } from '@supabase/supabase-js'


export type ConversationOutcome = 'pending' | 'interested' | 'not_interested' | 'sold' | 'needs_follow_up'

export interface SalesFunnel {
  active: { count: number; label: string }
  interested: { count: number; label: string; value: number }
  sold: { count: number; label: string; value: number }
  notInterested: { count: number; label: string }
  totalResolved: number
  conversionRate: number | null
}

export interface RevenueSummary {
  totalRevenue: number
  pipelineValue: number
  aiCost: number
  netReturn: number
  avgDealValue: number | null
  dealCount: number
  periodStart: string
  periodEnd: string
}

export interface OutcomeChangeRecord {
  from: string | null
  to: string
  at: string
}

const CUSTOMER_PROGRESSION: Record<string, number> = {
  new: 0,
  contacted: 1,
  interested: 2,
  converted: 3,
  lost: 2,
}

function canUpgradeCustomer(current: string, target: string): boolean {
  if (current === 'converted') return false
  const cur = CUSTOMER_PROGRESSION[current] ?? 0
  const tgt = CUSTOMER_PROGRESSION[target] ?? 0
  return tgt > cur || (current === 'lost' && target === 'interested')
}

function outcomeToCustomerStatus(outcome: ConversationOutcome): string | null {
  if (outcome === 'sold') return 'converted'
  if (outcome === 'interested') return 'interested'
  if (outcome === 'not_interested') return 'lost'
  return null
}

export async function getSalesFunnel(
  supabase: SupabaseClient,
  businessId: string
): Promise<SalesFunnel> {
  const defaultFunnel: SalesFunnel = {
    active: { count: 0, label: 'Activas' },
    interested: { count: 0, label: 'Interesados', value: 0 },
    sold: { count: 0, label: 'Vendidos', value: 0 },
    notInterested: { count: 0, label: 'No interesados' },
    totalResolved: 0,
    conversionRate: null,
  }

  try {
    const { data } = await supabase
      .from('conversations')
      .select('outcome, deal_value, potential_value, assistants!inner(business_id)')
      .eq('type', 'live')
      .eq('assistants.business_id', businessId)

    if (!data || data.length === 0) return defaultFunnel

    const active = data.filter((c) => c.outcome === null || c.outcome === 'pending')
    const interested = data.filter((c) => c.outcome === 'interested')
    const sold = data.filter((c) => c.outcome === 'sold')
    const notInterested = data.filter((c) => c.outcome === 'not_interested')

    const totalResolved = sold.length + notInterested.length

    return {
      active: { count: active.length, label: 'Activas' },
      interested: {
        count: interested.length,
        label: 'Interesados',
        value: interested.reduce((s, c) => s + (c.potential_value ?? 0), 0),
      },
      sold: {
        count: sold.length,
        label: 'Vendidos',
        value: sold.reduce((s, c) => s + (c.deal_value ?? 0), 0),
      },
      notInterested: { count: notInterested.length, label: 'No interesados' },
      totalResolved,
      conversionRate:
        totalResolved > 0
          ? Math.round((sold.length / totalResolved) * 100)
          : null,
    }
  } catch {
    return defaultFunnel
  }
}

export async function getRevenueSummary(
  supabase: SupabaseClient,
  businessId: string
): Promise<RevenueSummary> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  try {
    const { data: conversations } = await supabase
      .from('conversations')
      .select('deal_value, potential_value, outcome, created_at, assistants!inner(business_id)')
      .eq('type', 'live')
      .eq('assistants.business_id', businessId)

    const sold = (conversations ?? []).filter((c) => c.outcome === 'sold')

    const { data: usage } = await supabase
      .from('ai_usage')
      .select('cost')
      .eq('business_id', businessId)
      .gte('created_at', monthStart.toISOString())

    const totalRevenue = sold.reduce((s, c) => s + (c.deal_value ?? 0), 0)
    const pipelineValue = (conversations ?? [])
      .filter((c) => c.outcome === 'interested')
      .reduce((s, c) => s + (c.potential_value ?? 0), 0)
    const aiCost = (usage ?? []).reduce((s, u) => s + (u.cost ?? 0), 0)
    const dealCount = sold.filter((c) => (c.deal_value ?? 0) > 0).length

    return {
      totalRevenue,
      pipelineValue,
      aiCost,
      netReturn: totalRevenue - aiCost,
      avgDealValue: dealCount > 0 ? Math.round(totalRevenue / dealCount) : null,
      dealCount,
      periodStart: monthStart.toISOString(),
      periodEnd: now.toISOString(),
    }
  } catch {
    return {
      totalRevenue: 0,
      pipelineValue: 0,
      aiCost: 0,
      netReturn: 0,
      avgDealValue: null,
      dealCount: 0,
      periodStart: monthStart.toISOString(),
      periodEnd: now.toISOString(),
    }
  }
}

export async function updateConversationOutcome(
  supabase: SupabaseClient,
  businessId: string,
  conversationId: string,
  params: {
    outcome: ConversationOutcome
    deal_value?: number | null
    potential_value?: number | null
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, outcome, outcome_history, customer_id, assistants!inner(business_id)')
      .eq('id', conversationId)
      .eq('assistants.business_id', businessId)
      .single()

    if (!conv) return { success: false, error: 'Conversación no encontrada' }

    const previousOutcome = conv.outcome
    const now = new Date().toISOString()

    const historyEntry: OutcomeChangeRecord = {
      from: previousOutcome,
      to: params.outcome,
      at: now,
    }

    const currentHistory = Array.isArray(conv.outcome_history) ? conv.outcome_history : []

    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        outcome: params.outcome,
        deal_value: params.outcome === 'sold' ? (params.deal_value ?? null) : null,
        potential_value:
          params.outcome === 'interested' || params.outcome === 'needs_follow_up'
            ? (params.potential_value ?? null)
            : null,
        outcome_updated_at: now,
        outcome_history: [...currentHistory, historyEntry],
      })
      .eq('id', conversationId)

    if (updateError) return { success: false, error: updateError.message }

    if (conv.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('id, status')
        .eq('id', conv.customer_id)
        .single()

      if (customer) {
        const targetStatus = outcomeToCustomerStatus(params.outcome)
        if (targetStatus && canUpgradeCustomer(customer.status, targetStatus)) {
          await supabase
            .from('customers')
            .update({ status: targetStatus, updated_at: now })
            .eq('id', customer.id)
        }
      }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Error desconocido' }
  }
}
