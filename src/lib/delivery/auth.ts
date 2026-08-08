import type { NextRequest } from 'next/server'
import { createDeliveryAdmin } from './db'
import { DeliveryError } from './errors'
import { authenticateSession, SESSION_COOKIE } from './token'
import type { DeliveryDriver, DeliveryOrder, DeliveryVisit } from './types'

export interface DriverAuthResult {
  driver: DeliveryDriver
  slideTo: string | null
}

export async function requireDriverAuth(request: NextRequest): Promise<DriverAuthResult> {
  const cookieValue = request.cookies.get(SESSION_COOKIE)?.value

  if (!cookieValue) {
    throw new DeliveryError('DRIVER_UNAUTHORIZED', 'Sesión no iniciada', 401)
  }

  const result = await authenticateSession(cookieValue)

  if (result.driver.status === 'inactive') {
    throw new DeliveryError('DRIVER_UNAUTHORIZED', 'Repartidor desactivado', 403)
  }

  return result
}

export async function assertDriverOrderAccess(params: {
  businessId: string
  driverId: string
  orderId: string
}): Promise<DeliveryOrder> {
  const supabase = createDeliveryAdmin()
  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', params.orderId)
    .eq('business_id', params.businessId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!order) {
    throw new DeliveryError('NOT_FOUND', 'Pedido no encontrado', 404)
  }

  if (order.assigned_driver_id !== params.driverId) {
    throw new DeliveryError('FORBIDDEN', 'El pedido no está asignado a este repartidor', 403)
  }

  return order
}

export async function assertDriverVisitAccess(params: {
  businessId: string
  driverId: string
  visitId: string
}): Promise<DeliveryVisit> {
  const supabase = createDeliveryAdmin()
  const { data: visit, error } = await supabase
    .from('visits')
    .select('*')
    .eq('id', params.visitId)
    .eq('business_id', params.businessId)
    .eq('driver_id', params.driverId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!visit) {
    throw new DeliveryError('NOT_FOUND', 'Visita no encontrada', 404)
  }

  return visit
}

export async function assertDriverRouteAccess(params: {
  businessId: string
  driverId: string
  routeId: string
}): Promise<boolean> {
  const supabase = createDeliveryAdmin()
  const { data, error } = await supabase
    .from('routes')
    .select('id')
    .eq('id', params.routeId)
    .eq('business_id', params.businessId)
    .eq('driver_id', params.driverId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return Boolean(data)
}

export async function getDriverSettings(
  businessId: string
): Promise<{
  daily_goal_amount: number
  driver_share_percent: number
  timezone: string
  gps_radius_meters: number
}> {
  const supabase = createDeliveryAdmin()
  const { data, error } = await supabase
    .from('business_settings')
    .select('daily_goal_amount, driver_share_percent, timezone, gps_radius_meters')
    .eq('business_id', businessId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return {
    daily_goal_amount: data?.daily_goal_amount ?? 0,
    driver_share_percent: data?.driver_share_percent ?? 0,
    timezone: data?.timezone ?? 'UTC',
    gps_radius_meters: data?.gps_radius_meters ?? 100,
  }
}
