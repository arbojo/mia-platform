import { createDeliveryAdmin } from './db'
import { DeliveryError } from './errors'
import { assertValidTransition } from './closure'
import { validateGpsSamples, validateProximity, type GpsSample } from './gps'
import { buildDeliveryNotificationText, enqueueWhatsApp } from './whatsapp'
import { uploadEvidencePhoto, validateEvidencePhoto } from './evidence'
import type {
  DeliveryOrder,
  DeliveryVisit,
  DriverEventType,
  IncidentType,
  Kinship,
} from './types'

export interface ActionContext {
  businessId: string
  driverId: string
  visitId: string
}

export interface TransitionResult {
  visit: DeliveryVisit
  order: DeliveryOrder | null
  photoUrl?: string
  notified: boolean
}

interface LoadedVisit {
  visit: DeliveryVisit
  order: DeliveryOrder | null
}

function nowIso(): string {
  return new Date().toISOString()
}

async function loadVisitForAction(ctx: ActionContext): Promise<LoadedVisit> {
  const supabase = createDeliveryAdmin()
  const { data: visit, error } = await supabase
    .from('visits')
    .select('*')
    .eq('id', ctx.visitId)
    .eq('business_id', ctx.businessId)
    .eq('driver_id', ctx.driverId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (!visit) {
    throw new DeliveryError('NOT_FOUND', 'Visita no encontrada', 404)
  }

  let order: DeliveryOrder | null = null
  if (visit.order_id) {
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', visit.order_id)
      .eq('business_id', ctx.businessId)
      .maybeSingle()

    if (!orderError && orderData) {
      order = orderData
    }
  }

  return { visit, order }
}

async function insertDriverEvent(params: {
  ctx: ActionContext
  orderId: string | null
  eventType: DriverEventType
  samples?: [GpsSample, GpsSample]
  capturedAt?: string
  payload?: Record<string, unknown>
  idempotencyKey: string
}): Promise<void> {
  const supabase = createDeliveryAdmin()
  const latest = params.samples?.[1]
  const capturedAt =
    params.capturedAt ??
    (latest ? new Date(Math.max(new Date(params.samples![0].capturedAt).getTime(), new Date(latest.capturedAt).getTime())).toISOString() : nowIso())

  await supabase.from('driver_events').insert({
    business_id: params.ctx.businessId,
    driver_id: params.ctx.driverId,
    visit_id: params.ctx.visitId,
    order_id: params.orderId,
    event_type: params.eventType,
    lat: latest?.lat ?? null,
    lng: latest?.lng ?? null,
    captured_at: capturedAt,
    payload: params.payload ?? {},
    idempotency_key: params.idempotencyKey,
  })
}

function validateRadius(visit: DeliveryVisit, sample: GpsSample, radiusMeters: number): void {
  if (visit.customer_lat !== null && visit.customer_lng !== null) {
    validateProximity({
      visitLat: visit.customer_lat,
      visitLng: visit.customer_lng,
      sample,
      radiusMeters,
    })
  }
}

async function notifyCustomer(params: {
  businessId: string
  visit: DeliveryVisit
  order: DeliveryOrder | null
  driverName: string
  kind: 'voy_en_camino' | 'ya_estoy_aqui'
}): Promise<boolean> {
  if (!params.order) return false

  const text = buildDeliveryNotificationText(params.kind, {
    orderNumber: params.order.order_number,
    customerName: params.order.customer_name,
    driverName: params.driverName,
    amount: params.order.amount,
    paidAtSale: params.order.paid_at_sale,
  })

  const { queued } = await enqueueWhatsApp({
    businessId: params.businessId,
    to: params.order.phone ?? '',
    text,
  })

  return queued
}

export async function applyEnRoute(
  ctx: ActionContext,
  params: { samples: [GpsSample, GpsSample]; driverName: string; radiusMeters: number }
): Promise<TransitionResult> {
  const supabase = createDeliveryAdmin()
  const { visit, order } = await loadVisitForAction(ctx)

  assertValidTransition(visit.status, 'en_camino')
  validateGpsSamples({ samples: params.samples, receivedAt: nowIso() })

  const latest = params.samples[1]
  const idempotencyKey = `${ctx.driverId}:voy_en_camino:${ctx.visitId}:${new Date(latest.capturedAt).getTime()}`

  const notified = visit.notified
    ? true
    : await notifyCustomer({ businessId: ctx.businessId, visit, order, driverName: params.driverName, kind: 'voy_en_camino' })

  const { error } = await supabase
    .from('visits')
    .update({
      status: 'en_camino',
      notified,
      last_gps_lat: latest.lat,
      last_gps_lng: latest.lng,
      updated_at: nowIso(),
    })
    .eq('id', ctx.visitId)

  if (error) {
    throw error
  }

  await insertDriverEvent({
    ctx,
    orderId: order?.id ?? null,
    eventType: 'voy_en_camino',
    samples: params.samples,
    idempotencyKey,
  })

  return { visit: { ...visit, status: 'en_camino', notified, last_gps_lat: latest.lat, last_gps_lng: latest.lng }, order, notified }
}

export async function applyArrived(
  ctx: ActionContext,
  params: { samples: [GpsSample, GpsSample]; driverName: string; radiusMeters: number }
): Promise<TransitionResult> {
  const supabase = createDeliveryAdmin()
  const { visit, order } = await loadVisitForAction(ctx)

  assertValidTransition(visit.status, 'en_ubicacion')
  validateGpsSamples({ samples: params.samples, receivedAt: nowIso() })
  validateRadius(visit, params.samples[1], params.radiusMeters)

  const latest = params.samples[1]
  const idempotencyKey = `${ctx.driverId}:ya_estoy_aqui:${ctx.visitId}:${new Date(latest.capturedAt).getTime()}`

  const notified = visit.notified
    ? true
    : await notifyCustomer({ businessId: ctx.businessId, visit, order, driverName: params.driverName, kind: 'ya_estoy_aqui' })

  const { error } = await supabase
    .from('visits')
    .update({
      status: 'en_ubicacion',
      notified,
      last_gps_lat: latest.lat,
      last_gps_lng: latest.lng,
      updated_at: nowIso(),
    })
    .eq('id', ctx.visitId)

  if (error) {
    throw error
  }

  await insertDriverEvent({
    ctx,
    orderId: order?.id ?? null,
    eventType: 'ya_estoy_aqui',
    samples: params.samples,
    idempotencyKey,
  })

  return { visit: { ...visit, status: 'en_ubicacion', notified, last_gps_lat: latest.lat, last_gps_lng: latest.lng }, order, notified }
}

export async function applyDelivered(
  ctx: ActionContext,
  params: {
    samples: [GpsSample, GpsSample]
    radiusMeters: number
    kinship: Kinship
    amountCollected?: number
    paymentMethod?: string
    photo: Buffer
    capturedAt?: string
  }
): Promise<TransitionResult> {
  const supabase = createDeliveryAdmin()
  const { visit, order } = await loadVisitForAction(ctx)

  assertValidTransition(visit.status, 'entregado')
  validateGpsSamples({ samples: params.samples, receivedAt: nowIso() })
  validateRadius(visit, params.samples[1], params.radiusMeters)

  const imageType = validateEvidencePhoto(params.photo)
  const photoPath = await uploadEvidencePhoto({
    businessId: ctx.businessId,
    driverId: ctx.driverId,
    orderId: order?.id ?? ctx.visitId,
    buffer: params.photo,
    type: imageType,
  })

  const latest = params.samples[1]
  const deliveredAt = nowIso()
  const idempotencyKey = `${ctx.driverId}:entrega_realizada:${ctx.visitId}:${new Date(latest.capturedAt).getTime()}`

  const { error: visitError } = await supabase
    .from('visits')
    .update({
      status: 'entregado',
      received_by_kinship: params.kinship,
      amount_collected: params.amountCollected ?? null,
      payment_method: params.paymentMethod ?? null,
      photo_url: photoPath,
      last_gps_lat: latest.lat,
      last_gps_lng: latest.lng,
      delivered_at: deliveredAt,
      updated_at: deliveredAt,
    })
    .eq('id', ctx.visitId)

  if (visitError) {
    throw visitError
  }

  if (order) {
    const { error: orderError } = await supabase
      .from('orders')
      .update({ status: 'delivered', delivered_at: deliveredAt })
      .eq('id', order.id)

    if (orderError) {
      throw orderError
    }
  }

  const { error: evidenceError } = await supabase.from('evidence_photos').insert({
    business_id: ctx.businessId,
    visit_id: ctx.visitId,
    order_id: order?.id ?? null,
    driver_id: ctx.driverId,
    storage_path: photoPath,
    taken_at: params.capturedAt ?? deliveredAt,
    lat: latest.lat,
    lng: latest.lng,
    idempotency_key: idempotencyKey,
  })

  if (evidenceError) {
    throw evidenceError
  }

  await insertDriverEvent({
    ctx,
    orderId: order?.id ?? null,
    eventType: 'entrega_realizada',
    samples: params.samples,
    capturedAt: params.capturedAt,
    idempotencyKey,
  })

  return {
    visit: {
      ...visit,
      status: 'entregado',
      received_by_kinship: params.kinship,
      amount_collected: params.amountCollected ?? null,
      payment_method: params.paymentMethod ?? null,
      photo_url: photoPath,
      delivered_at: deliveredAt,
    },
    order: order ? { ...order, status: 'delivered' } : null,
    photoUrl: photoPath,
    notified: visit.notified,
  }
}

export async function applyIncident(
  ctx: ActionContext,
  params: {
    samples?: [GpsSample, GpsSample]
    incidentType: IncidentType
    notes?: string
    scheduleRevisit?: boolean
  }
): Promise<TransitionResult> {
  const supabase = createDeliveryAdmin()
  const { visit, order } = await loadVisitForAction(ctx)

  assertValidTransition(visit.status, 'incidencia')

  if (params.samples) {
    validateGpsSamples({ samples: params.samples, receivedAt: nowIso() })
  }

  const latest = params.samples?.[1] ?? null
  const idempotencyKey = `${ctx.driverId}:incidencia_reportada:${ctx.visitId}:${Date.now()}`

  const { error } = await supabase
    .from('visits')
    .update({
      status: 'incidencia',
      incident_type: params.incidentType,
      incident_notes: params.notes ?? null,
      last_gps_lat: latest?.lat ?? visit.last_gps_lat,
      last_gps_lng: latest?.lng ?? visit.last_gps_lng,
      updated_at: nowIso(),
    })
    .eq('id', ctx.visitId)

  if (error) {
    throw error
  }

  if (order) {
    await supabase
      .from('orders')
      .update({ status: 'incidence' })
      .eq('id', order.id)
  }

  await insertDriverEvent({
    ctx,
    orderId: order?.id ?? null,
    eventType: 'incidencia_reportada',
    samples: params.samples,
    payload: { incident_type: params.incidentType, notes: params.notes ?? null },
    idempotencyKey,
  })

  if (params.scheduleRevisit) {
    await scheduleRevisit({ ctx, originalVisitId: ctx.visitId })
  }

  return {
    visit: { ...visit, status: 'incidencia', incident_type: params.incidentType, incident_notes: params.notes ?? null },
    order: order ? { ...order, status: 'incidence' } : null,
    notified: visit.notified,
  }
}

export async function scheduleRevisit(params: {
  ctx: ActionContext
  originalVisitId: string
}): Promise<DeliveryVisit> {
  const supabase = createDeliveryAdmin()
  const { visit } = await loadVisitForAction(params.ctx)

  if (visit.status !== 'incidencia') {
    throw new DeliveryError('WRONG_STATUS', 'Solo se puede reprogramar una visita con incidencia', 409)
  }

  const { data: maxRow, error: maxError } = await supabase
    .from('visits')
    .select('sequence')
    .eq('route_id', visit.route_id)
    .order('sequence', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (maxError) {
    throw maxError
  }

  const { data: revisit, error } = await supabase
    .from('visits')
    .insert({
      business_id: params.ctx.businessId,
      route_id: visit.route_id,
      order_id: visit.order_id,
      driver_id: params.ctx.driverId,
      sequence: (maxRow?.sequence ?? 0) + 1,
      status: 'pendiente',
      revisit_of: params.originalVisitId,
      customer_lat: visit.customer_lat,
      customer_lng: visit.customer_lng,
      idempotency_key: `${params.ctx.driverId}:revisit_programada:${params.originalVisitId}:${Date.now()}`,
    })
    .select('*')
    .single()

  if (error || !revisit) {
    throw error ?? new DeliveryError('CONFLICT', 'No se pudo reprogramar la visita', 500)
  }

  await insertDriverEvent({
    ctx: params.ctx,
    orderId: visit.order_id,
    eventType: 'revisit_programada',
    payload: { revisit_visit_id: revisit.id },
    idempotencyKey: `${params.ctx.driverId}:revisit_programada:${params.originalVisitId}:${Date.now()}`,
  })

  return revisit
}
