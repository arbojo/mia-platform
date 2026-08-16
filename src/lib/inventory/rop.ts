import { createInventoryAdmin } from './db'
import type { ReplenishmentItem, Semaforo } from './types'

export interface RopInput {
  businessId: string
  assetId: string
  leadTimeDays: number | null
}

export async function calculateRop(input: RopInput): Promise<number> {
  const supabase = createInventoryAdmin()

  const { data, error } = await supabase.rpc('calculate_rop_for_asset', {
    p_asset_id: input.assetId,
    p_lead_time_days: input.leadTimeDays,
  })

  if (error) throw error

  return (data ?? 0) as number
}

export function semaforo(currentQty: number, rop: number): Semaforo {
  if (currentQty === 0) return 'rojo'
  if (currentQty <= Math.max(rop, 1)) return 'amarillo'
  return 'verde'
}

export async function listReplenishmentDashboard(businessId: string): Promise<ReplenishmentItem[]> {
  const supabase = createInventoryAdmin()

  const { data, error } = await supabase
    .from('replenishment_dashboard')
    .select('*')
    .eq('business_id', businessId)
    .order('semaforo', { ascending: true })
    .limit(500)

  if (error) throw error

  return (data ?? []) as unknown as ReplenishmentItem[]
}

export async function suggestPurchaseOrders(businessId: string): Promise<number> {
  const supabase = createInventoryAdmin()

  const { data, error } = await supabase.rpc('suggest_purchase_orders', {
    p_business_id: businessId,
  })

  if (error) throw error

  return (data ?? 0) as number
}
