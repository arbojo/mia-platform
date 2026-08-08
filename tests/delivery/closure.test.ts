import { describe, it, expect } from 'vitest'
import {
  computeClosureStats,
  assertValidTransition,
  VISIT_STATUS_TRANSITIONS,
} from '@/lib/delivery/closure'
import { DeliveryError } from '@/lib/delivery/errors'
import type { DeliveryVisit, VisitStatus } from '@/lib/delivery/types'

function visit(status: VisitStatus, amount: number | null = null): DeliveryVisit {
  return {
    id: 'visit-1',
    business_id: 'biz-1',
    route_id: 'route-1',
    order_id: 'order-1',
    driver_id: 'driver-1',
    sequence: 1,
    status,
    incident_type: null,
    incident_notes: null,
    received_by_kinship: null,
    amount_collected: amount,
    payment_method: null,
    photo_url: null,
    revisit_of: null,
    notified: false,
    calibrated_gps: false,
    customer_lat: null,
    customer_lng: null,
    last_gps_lat: null,
    last_gps_lng: null,
    idempotency_key: null,
    created_at: '2026-01-01T00:00:00.000Z',
    delivered_at: null,
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

describe('computeClosureStats', () => {
  it('aggregates statuses and collected amounts', () => {
    const stats = computeClosureStats([
      visit('entregado', 100),
      visit('entregado', 50.75),
      visit('incidencia'),
      visit('revisit'),
      visit('pendiente'),
    ])

    expect(stats.total_orders).toBe(5)
    expect(stats.delivered_count).toBe(2)
    expect(stats.incidence_count).toBe(1)
    expect(stats.revisit_count).toBe(1)
    expect(stats.pending_count).toBe(1)
    expect(stats.total_collected).toBe(150.75)
  })

  it('returns zeros for an empty route', () => {
    const stats = computeClosureStats([])
    expect(stats).toEqual({
      total_orders: 0,
      delivered_count: 0,
      incidence_count: 0,
      revisit_count: 0,
      total_collected: 0,
      pending_count: 0,
    })
  })

  it('ignores null amounts', () => {
    const stats = computeClosureStats([visit('entregado'), visit('entregado', 25)])
    expect(stats.total_collected).toBe(25)
  })
})

describe('assertValidTransition', () => {
  it('allows documented transitions', () => {
    for (const [from, targets] of Object.entries(VISIT_STATUS_TRANSITIONS)) {
      for (const to of targets) {
        expect(() => assertValidTransition(from as VisitStatus, to)).not.toThrow()
      }
    }
  })

  it('rejects invalid transitions', () => {
    try {
      assertValidTransition('pendiente', 'entregado')
      throw new Error('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(DeliveryError)
      expect((error as DeliveryError).code).toBe('WRONG_STATUS')
      expect((error as DeliveryError).statusCode).toBe(409)
    }
  })

  it('rejects transitions out of an entregado state', () => {
    try {
      assertValidTransition('entregado', 'incidencia')
      throw new Error('should have thrown')
    } catch (error) {
      expect((error as DeliveryError).code).toBe('WRONG_STATUS')
    }
  })
})
