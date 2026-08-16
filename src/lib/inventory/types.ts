export interface InventoryBusinessSettings {
  business_id: string
  enabled: boolean
  default_low_stock_threshold: number
  lead_time_days: number
  vertical: 'ecommerce' | 'manufacturing' | 'realestate'
  prediction_mode: PredictionMode
  default_min_qty: number | null
  default_max_qty: number | null
  safety_stock_days: number
  cx_promise_enabled: boolean
  late_delivery_threshold_days: number
  late_delivery_discount_percent: number
  compensation_max_amount: number | null
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
  | 'transfer_out'
  | 'transfer_in'

export type StockStatus = 'out' | 'low' | 'ok'

export type PredictionMode = 'minmax' | 'trend' | 'hybrid'

export interface InventoryAsset {
  id: string
  business_id: string
  item_type: 'sku' | 'material' | 'asset'
  tracking_mode: 'quantity' | 'serial' | 'single'
  code: string | null
  name: string
  attributes: Record<string, unknown>
  uom: string
  lifecycle_state: string
  location_id: string | null
  parent_asset_id: string | null
  current_qty: number
  min_qty: number | null
  max_qty: number | null
  version: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PredictionResult {
  model: PredictionMode
  forecast_qty: number
  suggested_qty: number
  reorder_point: number
  min_qty: number
  max_qty: number | null
  confidence: number
}

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
  product_id: string | null
  asset_id: string | null
  quantity_delta: number
  movement_type: MovementType
  unit_cost: number | null
  total_cost: number | null
  location_id: string | null
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

export type Semaforo = 'verde' | 'amarillo' | 'rojo'

export type PurchaseOrderStatus = 'suggested' | 'approved' | 'ordered' | 'in_transit' | 'received' | 'cancelled'

export interface Supplier {
  id: string
  business_id: string
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  lead_time_days: number
  lead_time_variance_days: number
  supplier_reliability_score: number
  webhook_secret: string | null
  attributes: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface PurchaseOrder {
  id: string
  business_id: string
  asset_id: string
  supplier_id: string | null
  status: PurchaseOrderStatus
  qty_suggested: number
  qty_ordered: number | null
  expected_at: string | null
  search_metadata: Record<string, unknown>
  suggestion_reason: Record<string, unknown>
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface BomItem {
  id: string
  business_id: string
  parent_asset_id: string
  component_asset_id: string
  qty_per_unit: number
  created_at: string
}

export interface ReplenishmentItem {
  business_id: string
  asset_id: string
  code: string | null
  name: string
  item_type: string
  location_id: string | null
  current_qty: number
  min_qty: number | null
  max_qty: number | null
  suggested_qty: number | null
  lead_time_days: number | null
  velocity30d: number
  rop: number
  semaforo: Semaforo
}

export type EtaSource = 'unavailable' | 'local' | 'transit' | 'purchase'

export interface EtaResult {
  source: EtaSource
  eta_days: number | null
  available_qty: number
  message: string
  breakdown: Record<string, unknown>
}

export interface DeliveryPromise {
  id: string
  business_id: string
  sales_event_id: string | null
  delivery_order_id: string | null
  promise_token: string
  promised_delivery_date: string
  tolerance_days: number
  discount_percent: number
  original_amount: number
  adjusted_amount: number | null
  discount_amount: number | null
  status: 'pending_fulfillment' | 'fulfilled' | 'compensated' | 'void'
  compensated_at: string | null
  gateway_status: 'not_configured' | 'ready_capture' | 'captured' | 'failed'
  payment_context: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Transfer {
  id: string
  business_id: string
  transfer_number: string
  from_location_id: string
  to_location_id: string
  asset_id: string
  qty: number
  status: 'in_transit' | 'arrived' | 'cancelled'
  estimated_arrival: string | null
  shipped_at: string
  arrived_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
