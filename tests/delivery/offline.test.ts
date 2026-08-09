import { describe, it, expect } from 'vitest'
import {
  isRetryableError,
  buildSyncItem,
  buildDeliveryFormData,
  partitionOutbox,
} from '@/components/driver/offline'
import { DriverApiError } from '@/components/driver/api'
import type { OutboxAction } from '@/components/driver/outbox'

function action(overrides: Partial<OutboxAction> = {}): OutboxAction {
  return {
    idempotencyKey: 'abc-1234-delivery',
    eventType: 'entrega_realizada',
    visitId: '00000000-0000-4000-8000-000000000001',
    ...overrides,
  }
}

describe('isRetryableError', () => {
  it('trata los errores de red (TypeError) como reintentables', () => {
    expect(isRetryableError(new TypeError('fetch failed'))).toBe(true)
  })

  it('trata un abort por timeout como reintentable', () => {
    expect(isRetryableError(new DOMException('timeout', 'AbortError'))).toBe(true)
  })

  it('trata errores 5xx como reintentables', () => {
    expect(isRetryableError(new DriverApiError('boom', 500))).toBe(true)
    expect(isRetryableError(new DriverApiError('bad gateway', 502))).toBe(true)
  })

  it('no reintenta errores 4xx', () => {
    expect(isRetryableError(new DriverApiError('invalid input', 400))).toBe(false)
    expect(isRetryableError(new DriverApiError('unauthorized', 401))).toBe(false)
  })

  it('no reintenta errores arbitrarios', () => {
    expect(isRetryableError(new Error('otro error'))).toBe(false)
  })
})

describe('buildSyncItem', () => {
  it('mapea una acción de outbox a un item de sync', () => {
    const samples = [
      { lat: -34.5, lng: -58.4, capturedAt: '2026-08-09T10:00:00.000Z' },
      { lat: -34.51, lng: -58.41, capturedAt: '2026-08-09T10:00:03.000Z' },
    ]
    const item = buildSyncItem(
      action({
        eventType: 'ya_estoy_aqui',
        orderId: '00000000-0000-4000-8000-000000000002',
        samples,
        payload: { note: 'x' },
      })
    )
    expect(item.idempotencyKey).toBe('abc-1234-delivery')
    expect(item.eventType).toBe('ya_estoy_aqui')
    expect(item.visitId).toBe('00000000-0000-4000-8000-000000000001')
    expect(item.orderId).toBe('00000000-0000-4000-8000-000000000002')
    expect(item.samples).toEqual(samples)
    expect(item.payload).toEqual({ note: 'x' })
  })
})

describe('buildDeliveryFormData', () => {
  it('reconstruye el FormData de la entrega con foto y muestras GPS', () => {
    const formData = buildDeliveryFormData(
      action({
        orderId: '00000000-0000-4000-8000-000000000002',
        samples: [
          { lat: -34.5, lng: -58.4, capturedAt: '2026-08-09T10:00:00.000Z' },
          { lat: -34.51, lng: -58.41, capturedAt: '2026-08-09T10:00:03.000Z' },
        ],
        photo: new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], { type: 'image/jpeg' }),
        photoType: 'image/jpeg',
        photoName: 'evidencia.jpg',
        payload: {
          kinship: 'vecino',
          amount_collected: '1250.50',
          payment_method: 'transferencia',
        },
      })
    )

    expect(formData.get('kinship')).toBe('vecino')
    expect(formData.get('amount_collected')).toBe('1250.50')
    expect(formData.get('payment_method')).toBe('transferencia')
    expect(formData.get('samples_lat1')).toBe('-34.5')
    expect(formData.get('samples_lng2')).toBe('-58.41')
    expect(formData.get('samples_captured_at2')).toBe('2026-08-09T10:00:03.000Z')
    expect(formData.get('photo')).toBeInstanceOf(Blob)
  })

  it('usa defaults cuando faltan campos', () => {
    const formData = buildDeliveryFormData(action())
    expect(formData.get('kinship')).toBe('titular')
    expect(formData.get('amount_collected')).toBe('0')
    expect(formData.get('payment_method')).toBe('efectivo')
    expect(formData.get('photo')).toBeNull()
  })
})

describe('partitionOutbox', () => {
  it('separa entregas diferidas de las acciones de sync', () => {
    const actions: OutboxAction[] = [
      action({ eventType: 'entrega_realizada' }),
      action({ eventType: 'voy_en_camino' }),
      action({ eventType: 'incidencia_reportada' }),
      action({ eventType: 'entrega_realizada', failed: true }),
    ]
    const { deliveries, sync } = partitionOutbox(actions)
    expect(deliveries).toHaveLength(1)
    expect(sync).toHaveLength(2)
    expect(deliveries[0].eventType).toBe('entrega_realizada')
  })
})
