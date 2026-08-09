export interface InventoryBusinessSettings {
  business_id: string
  enabled: boolean
  default_low_stock_threshold: number
  lead_time_days: number
  updated_at: string
}

export type MovementType =
  | 'initial'
  | 'sale'
  | 'purchase'
  | 'adjustment'
  | 'restock'
  | 'waste'
  | 'return'
  | 'import'

export type StockStatus = 'out' | 'low' | 'ok'

export interface StockItem {
  business_id: string
  product_id: string
  quantity: number
  low_stock_threshold: number
  version: number
  created_at: string
  updated_at: string
}

export interface StockItemWithProduct extends StockItem {
  product_name: string
  sku: string | null
  price: number | null
  status: StockStatus
  daysOut: number | null
  velocity7d: number
  velocity30d: number
}

export interface StockMovement {
  id: string
  business_id: string
  product_id: string
  quantity_delta: number
  movement_type: MovementType
  reference_id: string | null
  reference_type: string | null
  reason: string | null
  created_by: string | null
  created_at: string
}

export interface RestockSuggestion {
  id: string
  business_id: string
  product_id: string
  current_quantity: number
  low_stock_threshold: number
  suggested_qty: number
  reason: unknown
  ai_summary: string | null
  ai_used: boolean
  tokens_used: number
  status: 'pending' | 'dismissed' | 'done'
  generated_at: string
  updated_at: string
}

export interface RestockSuggestionWithProduct extends RestockSuggestion {
  product_name: string
  sku: string | null
}

export interface DemandSignal {
  daysOut: number | null
  velocity7d: number
  velocity30d: number
  salesValue30d: number
}

export interface RestockReason {
  low_stock: boolean
  days_out: number | null
  velocity7d: number
  velocity30d: number
  suggested_qty: number
}
