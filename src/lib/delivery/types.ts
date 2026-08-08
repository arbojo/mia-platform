export interface DeliveryBusinessSettings {
  business_id: string
  enabled: boolean
  driver_self_checkout: boolean
  whatsapp_notify: boolean
  wa_business_id: string | null
  timezone: string
  daily_goal_amount: number
  driver_share_percent: number
  gps_radius_meters: number
  created_at: string
  updated_at: string
}

export type DriverStatus = 'active' | 'inactive' | 'busy'

export interface DeliveryDriver {
  id: string
  business_id: string
  sequential_number: number
  name: string
  phone: string | null
  vehicle: string | null
  status: DriverStatus
  auth_token_hash: string | null
  auth_token_salt: string | null
  auth_token_expires_at: string | null
  token_revoked_at: string | null
  last_lat: number | null
  last_lng: number | null
  created_at: string
  updated_at: string
}

export type DeliveryOrderStatus =
  | 'pending_assignment'
  | 'assigned'
  | 'in_transit'
  | 'delivered'
  | 'incidence'
  | 'cancelled'

export interface DeliveryOrder {
  id: string
  business_id: string
  sales_event_id: string
  conversation_id: string | null
  customer_id: string | null
  product_id: string | null
  order_number: string
  customer_name: string
  phone: string | null
  address: string | null
  city: string | null
  amount: number | null
  paid_at_sale: boolean
  items: unknown
  status: DeliveryOrderStatus
  assigned_driver_id: string | null
  assigned_at: string | null
  route_id: string | null
  source: unknown
  created_at: string
  delivered_at: string | null
  cancelled_at: string | null
}

export type RouteStatus = 'draft' | 'active' | 'closed'

export interface DeliveryRoute {
  id: string
  business_id: string
  driver_id: string
  route_date: string
  status: RouteStatus
  closed_at: string | null
  created_at: string
}

export type VisitStatus = 'pendiente' | 'en_camino' | 'en_ubicacion' | 'entregado' | 'incidencia' | 'revisit'

export type IncidentType = 'domicilio_incorrecto' | 'no_se_encuentra' | 'rechazado' | 'zona_inaccesible' | 'cliente_ausente' | 'otro'

export type Kinship = 'titular' | 'familiar' | 'vecino' | 'recibe_tercero'

export interface DeliveryVisit {
  id: string
  business_id: string
  route_id: string
  order_id: string
  driver_id: string
  sequence: number
  status: VisitStatus
  incident_type: IncidentType | null
  incident_notes: string | null
  received_by_kinship: Kinship | null
  amount_collected: number | null
  payment_method: string | null
  photo_url: string | null
  revisit_of: string | null
  notified: boolean
  calibrated_gps: boolean
  customer_lat: number | null
  customer_lng: number | null
  last_gps_lat: number | null
  last_gps_lng: number | null
  idempotency_key: string | null
  created_at: string
  delivered_at: string | null
  updated_at: string
}

export type DriverEventType =
  | 'voy_en_camino'
  | 'ya_estoy_aqui'
  | 'entrega_realizada'
  | 'incidencia_reportada'
  | 'revisit_programada'
  | 'check_in'
  | 'sync_batch'

export interface DriverEvent {
  id: string
  business_id: string
  driver_id: string
  visit_id: string | null
  order_id: string | null
  event_type: DriverEventType
  lat: number | null
  lng: number | null
  captured_at: string
  received_at: string
  payload: unknown
  idempotency_key: string | null
  created_at: string
}

export interface DailyClosure {
  id: string
  business_id: string
  route_id: string
  driver_id: string
  closure_date: string
  state: 'open' | 'closed' | 'adjusted'
  total_orders: number
  delivered_count: number
  incidence_count: number
  revisit_count: number
  total_collected: number
  cash_counted: number
  expenses: unknown
  notes: string | null
  closed_at: string | null
  closed_by: string | null
  created_at: string
}
