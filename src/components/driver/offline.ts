'use client'

import { driverFetch, driverUpload, DriverApiError } from '@/components/driver/api'
import {
  getPendingActions,
  removeAction,
  updateAction,
  type OutboxAction,
} from '@/components/driver/outbox'

export const SYNC_BATCH_SIZE = 50
export const DELIVERY_EVENT = 'entrega_realizada'

export interface SyncItem {
  idempotencyKey: string
  eventType: string
  visitId: string
  orderId?: string | null
  samples?: unknown
  payload?: Record<string, unknown>
}

export interface FlushResult {
  sync: { sent: number; failed: number }
  deliveries: { sent: number; failed: number }
  remaining: number
}

export function isRetryableError(err: unknown): boolean {
  if (err instanceof TypeError) return true
  if (err instanceof DOMException && err.name === 'AbortError') return true
  if (err instanceof DriverApiError) return err.status >= 500
  return false
}

export function buildSyncItem(action: OutboxAction): SyncItem {
  return {
    idempotencyKey: action.idempotencyKey,
    eventType: action.eventType,
    visitId: action.visitId,
    orderId: action.orderId ?? null,
    samples: action.samples,
    payload: action.payload,
  }
}

export function buildDeliveryFormData(action: OutboxAction): FormData {
  const formData = new FormData()
  const payload = action.payload ?? {}

  formData.append('kinship', typeof payload.kinship === 'string' ? payload.kinship : 'titular')
  const amount = payload.amount_collected
  formData.append(
    'amount_collected',
    typeof amount === 'string' || typeof amount === 'number' ? String(amount) : '0'
  )
  formData.append(
    'payment_method',
    typeof payload.payment_method === 'string' ? payload.payment_method : 'efectivo'
  )

  const [first, second] = action.samples ?? []
  if (first) {
    formData.append('samples_lat1', String(first.lat))
    formData.append('samples_lng1', String(first.lng))
    formData.append('samples_captured_at1', first.capturedAt)
  }
  if (second) {
    formData.append('samples_lat2', String(second.lat))
    formData.append('samples_lng2', String(second.lng))
    formData.append('samples_captured_at2', second.capturedAt)
  }
  if (action.photo) {
    formData.append(
      'photo',
      new File([action.photo], action.photoName ?? 'evidence.jpg', {
        type: action.photoType ?? action.photo.type ?? 'image/jpeg',
      })
    )
  }
  return formData
}

export function partitionOutbox(actions: OutboxAction[]): {
  deliveries: OutboxAction[]
  sync: OutboxAction[]
} {
  const pending = actions.filter((a) => !a.failed)
  return {
    deliveries: pending.filter((a) => a.eventType === DELIVERY_EVENT),
    sync: pending.filter((a) => a.eventType !== DELIVERY_EVENT),
  }
}

async function markAttempt(action: OutboxAction): Promise<void> {
  await updateAction({ ...action, attempts: (action.attempts ?? 0) + 1 })
}

async function markFailed(action: OutboxAction, lastError: string): Promise<void> {
  await updateAction({ ...action, failed: true, lastError })
}

export async function flushOutbox(): Promise<FlushResult> {
  const actions = await getPendingActions()
  const { deliveries, sync } = partitionOutbox(actions)
  const result: FlushResult = {
    sync: { sent: 0, failed: 0 },
    deliveries: { sent: 0, failed: 0 },
    remaining: 0,
  }

  for (let index = 0; index < sync.length; index += SYNC_BATCH_SIZE) {
    const batch = sync.slice(index, index + SYNC_BATCH_SIZE)
    let body: {
      results: Array<{
        idempotencyKey: string
        status: 'ok' | 'deduplicated' | 'error'
        error?: string
      }>
    }
    try {
      body = await driverFetch('/api/driver/sync', {
        method: 'POST',
        body: JSON.stringify({ items: batch.map(buildSyncItem) }),
      })
    } catch {
      for (const action of batch) {
        await markAttempt(action)
      }
      continue
    }

    for (const action of batch) {
      const outcome = body.results.find((r) => r.idempotencyKey === action.idempotencyKey)
      if (outcome?.status === 'ok' || outcome?.status === 'deduplicated') {
        await removeAction(action.idempotencyKey)
        result.sync.sent += 1
      } else {
        await markFailed(action, outcome?.error ?? 'Error en la sincronización')
        result.sync.failed += 1
      }
    }
  }

  for (const action of deliveries) {
    try {
      await driverUpload(
        `/api/driver/deliveries/${action.visitId}/delivered`,
        buildDeliveryFormData(action)
      )
      await removeAction(action.idempotencyKey)
      result.deliveries.sent += 1
    } catch (err) {
      const isTerminalClientError =
        err instanceof DriverApiError && err.status >= 400 && err.status < 500 && err.status !== 401
      if (isTerminalClientError) {
        await markFailed(action, err.message)
        result.deliveries.failed += 1
      } else {
        await markAttempt(action)
      }
    }
  }

  result.remaining = (await getPendingActions()).filter((a) => !a.failed).length
  return result
}

export async function getPendingCounts(): Promise<{ pending: number; failed: number }> {
  const actions = await getPendingActions()
  return {
    pending: actions.filter((a) => !a.failed).length,
    failed: actions.filter((a) => a.failed).length,
  }
}
