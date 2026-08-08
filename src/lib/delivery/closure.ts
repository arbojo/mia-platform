import { createDeliveryAdmin } from './db'
import { DeliveryError } from './errors'
import type { DeliveryVisit, VisitStatus } from './types'

export function getBusinessDate(timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return parts
}

export interface ClosureStats {
  total_orders: number
  delivered_count: number
  incidence_count: number
  revisit_count: number
  total_collected: number
  pending_count: number
}

export function computeClosureStats(visits: DeliveryVisit[]): ClosureStats {
  return visits.reduce<ClosureStats>(
    (acc, visit) => {
      acc.total_orders += 1
      if (visit.status === 'entregado') acc.delivered_count += 1
      if (visit.status === 'incidencia') acc.incidence_count += 1
      if (visit.status === 'revisit') acc.revisit_count += 1
      if (visit.status === 'pendiente') acc.pending_count += 1
      acc.total_collected += visit.amount_collected ?? 0
      return acc
    },
    { total_orders: 0, delivered_count: 0, incidence_count: 0, revisit_count: 0, total_collected: 0, pending_count: 0 }
  )
}

export async function getRouteVisits(routeId: string): Promise<DeliveryVisit[]> {
  const supabase = createDeliveryAdmin()
  const { data, error } = await supabase
    .from('visits')
    .select('*')
    .eq('route_id', routeId)

  if (error) {
    throw error
  }

  return data ?? []
}

export async function closeRoute(params: {
  routeId: string
  businessId: string
  driverId: string
  closureDate: string
  cashCounted: number
  expenses: Record<string, number>
  notes?: string | null
  closedBy: string | null
}): Promise<void> {
  const supabase = createDeliveryAdmin()
  const visits = await getRouteVisits(params.routeId)
  const stats = computeClosureStats(visits)

  const { error: upsertError } = await supabase.from('daily_closures').upsert({
    business_id: params.businessId,
    route_id: params.routeId,
    driver_id: params.driverId,
    closure_date: params.closureDate,
    state: 'closed',
    total_orders: stats.total_orders,
    delivered_count: stats.delivered_count,
    incidence_count: stats.incidence_count,
    revisit_count: stats.revisit_count,
    total_collected: Math.round(stats.total_collected * 100) / 100,
    cash_counted: params.cashCounted,
    expenses: params.expenses,
    notes: params.notes ?? null,
    closed_at: new Date().toISOString(),
    closed_by: params.closedBy,
  })

  if (upsertError) {
    throw upsertError
  }

  const { error: routeError } = await supabase
    .from('routes')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', params.routeId)
    .eq('business_id', params.businessId)

  if (routeError) {
    throw routeError
  }
}

export async function assertNoPendingClosure(params: {
  driverId: string
  routeDate: string
  excludeRouteId?: string
}): Promise<void> {
  const supabase = createDeliveryAdmin()
  let query = supabase
    .from('routes')
    .select('id')
    .eq('driver_id', params.driverId)
    .lt('route_date', params.routeDate)
    .neq('status', 'closed')

  if (params.excludeRouteId) {
    query = query.neq('id', params.excludeRouteId)
  }

  const { data, error } = await query.limit(1).maybeSingle()

  if (error) {
    throw error
  }

  if (data) {
    throw new DeliveryError(
      'CLOSURE_PENDING',
      'El repartidor tiene un cierre diario pendiente. Cierra la jornada anterior antes de asignar una nueva ruta.',
      409
    )
  }
}

export const VISIT_STATUS_TRANSITIONS: Record<VisitStatus, readonly VisitStatus[]> = {
  pendiente: ['en_camino', 'incidencia'],
  en_camino: ['en_ubicacion', 'incidencia'],
  en_ubicacion: ['entregado', 'incidencia'],
  entregado: [],
  incidencia: ['revisit'],
  revisit: ['en_camino', 'incidencia'],
}

export function assertValidTransition(from: VisitStatus, to: VisitStatus): void {
  const allowed = VISIT_STATUS_TRANSITIONS[from]
  if (!allowed.includes(to)) {
    throw new DeliveryError(
      'WRONG_STATUS',
      `Transición no permitida: ${from} → ${to}`,
      409
    )
  }
}
