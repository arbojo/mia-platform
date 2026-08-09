import type { StockStatus } from './types'

export function stockStatus(quantity: number, threshold: number): StockStatus {
  if (quantity <= 0) return 'out'
  if (quantity <= threshold) return 'low'
  return 'ok'
}

export function daysSince(lastSaleAt: string | null, now = Date.now()): number | null {
  if (!lastSaleAt) return null
  const elapsed = now - new Date(lastSaleAt).getTime()
  if (elapsed <= 0) return 0
  return Math.floor(elapsed / 86_400_000)
}

export function unitsSoldInWindow(
  sales: { created_at: string; quantity: number }[],
  windowDays: number,
  now = Date.now()
): number {
  const cutoff = now - windowDays * 86_400_000
  return sales.reduce((acc, sale) => {
    const at = new Date(sale.created_at).getTime()
    if (at >= cutoff) {
      return acc + Math.max(0, sale.quantity)
    }
    return acc
  }, 0)
}

export interface SuggestedQtyInput {
  velocity7d: number
  leadTimeDays: number
  quantity: number
  threshold: number
}

export function computeSuggestedQty(input: SuggestedQtyInput): number {
  const dailyRate = input.velocity7d / 7
  const restock = Math.ceil(dailyRate * input.leadTimeDays) - input.quantity
  return Math.max(input.threshold, restock)
}

export function buildRestockReason(input: {
  quantity: number
  threshold: number
  daysOut: number | null
  velocity7d: number
  velocity30d: number
  leadTimeDays: number
}): {
  low_stock: boolean
  days_out: number | null
  velocity7d: number
  velocity30d: number
  suggested_qty: number
} {
  const lowStock = input.quantity <= input.threshold
  const suggestedQty = computeSuggestedQty({
    velocity7d: input.velocity7d,
    leadTimeDays: input.leadTimeDays,
    quantity: input.quantity,
    threshold: input.threshold,
  })
  return {
    low_stock: lowStock,
    days_out: input.daysOut,
    velocity7d: input.velocity7d,
    velocity30d: input.velocity30d,
    suggested_qty: suggestedQty,
  }
}
