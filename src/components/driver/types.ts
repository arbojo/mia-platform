export interface DriverMeResponse {
  driver: {
    id: string
    name: string
    phone: string | null
    vehicle: string | null
  }
  settings: {
    daily_goal_amount: number
    driver_share_percent: number
  }
  route: { id: string; route_date: string; status: string } | null
  today: {
    total_orders: number
    delivered_count: number
    incidence_count: number
    revisit_count: number
    total_collected: number
    pending_count: number
  } | null
  incentives: {
    gross: number
    driver_share: number
    goal_progress: number
    effectiveness_percent: number
    delivered: number
    total: number
  } | null
  closure_pending: boolean
}

export type VisitStatus =
  | 'pendiente'
  | 'en_camino'
  | 'en_ubicacion'
  | 'entregado'
  | 'incidencia'
  | 'revisit'

export interface DeliveryListItem {
  visit_id: string
  order_id: string
  status: VisitStatus
  sequence: number
  order: {
    order_number?: string
    customer_name?: string
    phone?: string
    address?: string
    city?: string
    amount?: number
    paid_at_sale?: boolean
    items?: unknown
  } | null
}

export interface DeliveriesResponse {
  route_date: string
  deliveries: DeliveryListItem[]
}
