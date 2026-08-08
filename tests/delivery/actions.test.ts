import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/delivery/db', () => ({
  createDeliveryAdmin: vi.fn(),
}))
vi.mock('@/lib/delivery/evidence', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    uploadEvidencePhoto: vi.fn(),
  }
})
vi.mock('@/lib/delivery/whatsapp', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    enqueueWhatsApp: vi.fn(),
  }
})

import { applyEnRoute, applyDelivered } from '@/lib/delivery/actions'
import { createDeliveryAdmin } from '@/lib/delivery/db'
import { uploadEvidencePhoto } from '@/lib/delivery/evidence'
import { enqueueWhatsApp } from '@/lib/delivery/whatsapp'
import type { DeliveryVisit, DeliveryOrder, VisitStatus } from '@/lib/delivery/types'

const DRIVER_ID = '11111111-1111-1111-1111-111111111111'
const BUSINESS_ID = '22222222-2222-2222-2222-222222222222'
const VISIT_ID = '33333333-3333-3333-3333-333333333333'
const ORDER_ID = '44444444-4444-4444-4444-444444444444'

const ctx = { businessId: BUSINESS_ID, driverId: DRIVER_ID, visitId: VISIT_ID }

function freshSample(offsetMs: number) {
  return {
    lat: -34.6037,
    lng: -58.3816,
    capturedAt: new Date(Date.now() - offsetMs).toISOString(),
  }
}

function makeVisit(status: VisitStatus): DeliveryVisit {
  return {
    id: VISIT_ID,
    business_id: BUSINESS_ID,
    route_id: 'route-1',
    order_id: ORDER_ID,
    driver_id: DRIVER_ID,
    sequence: 1,
    status,
    incident_type: null,
    incident_notes: null,
    received_by_kinship: null,
    amount_collected: null,
    payment_method: null,
    photo_url: null,
    revisit_of: null,
    notified: false,
    calibrated_gps: false,
    customer_lat: -34.6037,
    customer_lng: -58.3816,
    last_gps_lat: null,
    last_gps_lng: null,
    idempotency_key: null,
    created_at: '2026-01-01T00:00:00.000Z',
    delivered_at: null,
    updated_at: '2026-01-01T00:00:00.000Z',
  }
}

function makeOrder(): DeliveryOrder {
  return {
    id: ORDER_ID,
    business_id: BUSINESS_ID,
    sales_event_id: 'event-1',
    conversation_id: null,
    customer_id: null,
    product_id: null,
    order_number: 'ORD-000001',
    customer_name: 'Juan',
    phone: '+5491155551234',
    address: 'Av. Siempre Viva 123',
    city: 'Buenos Aires',
    amount: 120,
    paid_at_sale: false,
    items: {},
    status: 'assigned',
    assigned_driver_id: DRIVER_ID,
    assigned_at: null,
    route_id: 'route-1',
    source: {},
    created_at: '2026-01-01T00:00:00.000Z',
    delivered_at: null,
    cancelled_at: null,
  }
}

interface FakeResult {
  data?: unknown
  error?: unknown
}

interface FakeBuilder {
  select: (...args: unknown[]) => FakeBuilder
  eq: (...args: unknown[]) => FakeBuilder
  lt: (...args: unknown[]) => FakeBuilder
  neq: (...args: unknown[]) => FakeBuilder
  limit: (...args: unknown[]) => FakeBuilder
  order: (...args: unknown[]) => FakeBuilder
  in: (...args: unknown[]) => FakeBuilder
  single: () => Promise<FakeResult>
  maybeSingle: () => Promise<FakeResult>
  insert: (...args: unknown[]) => FakeBuilder
  update: (...args: unknown[]) => FakeBuilder
  then: (resolve: (v: FakeResult) => void, reject: (e: unknown) => void) => Promise<void>
  catch: () => FakeBuilder
}

function createFakeDb(results: Record<string, () => FakeResult>) {
  const fromMock = vi.fn((table: string) => {
    const getResult = results[table] ?? (() => ({ data: null, error: null }))
    const builder: FakeBuilder = {
      select: () => builder,
      eq: () => builder,
      lt: () => builder,
      neq: () => builder,
      limit: () => builder,
      order: () => builder,
      in: () => builder,
      single: () => Promise.resolve(getResult()),
      maybeSingle: () => Promise.resolve(getResult()),
      insert: () => builder,
      update: () => builder,
      then: (resolve, reject) => Promise.resolve(getResult()).then(resolve, reject),
      catch: () => builder,
    }
    return builder
  })
  vi.mocked(createDeliveryAdmin).mockReturnValue({ from: fromMock } as never)
  return fromMock
}

describe('applyEnRoute', () => {
  beforeEach(() => {
    vi.mocked(enqueueWhatsApp).mockReset()
    vi.mocked(uploadEvidencePhoto).mockReset()
  })

  it('transitions a pendiente visit to en_camino', async () => {
    vi.mocked(enqueueWhatsApp).mockResolvedValue({ queued: false, skipped: true })
    createFakeDb({
      visits: () => ({ data: makeVisit('pendiente') }),
      orders: () => ({ data: makeOrder() }),
    })

    const result = await applyEnRoute(ctx, {
      samples: [freshSample(1000), freshSample(2000)],
      driverName: 'Carlos',
      radiusMeters: 200,
    })

    expect(result.visit.status).toBe('en_camino')
    expect(result.order?.order_number).toBe('ORD-000001')
    expect(result.notified).toBe(false)
  })

  it('throws WRONG_STATUS when the transition is invalid', async () => {
    createFakeDb({
      visits: () => ({ data: makeVisit('entregado') }),
    })

    await expect(
      applyEnRoute(ctx, {
        samples: [freshSample(1000), freshSample(2000)],
        driverName: 'Carlos',
        radiusMeters: 200,
      })
    ).rejects.toMatchObject({ code: 'WRONG_STATUS', statusCode: 409 })
  })

  it('throws NOT_FOUND when the visit does not belong to the driver', async () => {
    createFakeDb({ visits: () => ({ data: null }) })
    await expect(
      applyEnRoute(ctx, {
        samples: [freshSample(1000), freshSample(2000)],
        driverName: 'Carlos',
        radiusMeters: 200,
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND', statusCode: 404 })
  })

  it('rejects stale GPS samples', async () => {
    createFakeDb({ visits: () => ({ data: makeVisit('pendiente') }) })
    const stale = {
      lat: -34.6037,
      lng: -58.3816,
      capturedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    }
    await expect(
      applyEnRoute(ctx, {
        samples: [stale, stale],
        driverName: 'Carlos',
        radiusMeters: 200,
      })
    ).rejects.toMatchObject({ code: 'GPS_REJECTED' })
  })
})

describe('applyDelivered', () => {
  beforeEach(() => {
    vi.mocked(enqueueWhatsApp).mockReset()
    vi.mocked(uploadEvidencePhoto).mockReset()
  })

  it('delivers a visit and stores evidence', async () => {
    vi.mocked(uploadEvidencePhoto).mockResolvedValue('biz/driver/order/evidence.jpeg')
    const fromMock = createFakeDb({
      visits: () => ({ data: makeVisit('en_ubicacion') }),
      orders: () => ({ data: makeOrder() }),
    })

    const photo = Buffer.alloc(100)
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(photo)

    const result = await applyDelivered(ctx, {
      samples: [freshSample(1000), freshSample(2000)],
      radiusMeters: 200,
      kinship: 'titular',
      amountCollected: 120,
      paymentMethod: 'efectivo',
      photo,
    })

    expect(result.visit.status).toBe('entregado')
    expect(result.visit.received_by_kinship).toBe('titular')
    expect(result.visit.amount_collected).toBe(120)
    expect(result.photoUrl).toBe('biz/driver/order/evidence.jpeg')
    expect(result.order?.status).toBe('delivered')

    const tables = fromMock.mock.calls.map(([table]) => table)
    expect(tables).toContain('evidence_photos')
    expect(tables).toContain('driver_events')
    expect(tables).toContain('orders')
  })

  it('rejects a delivery from a pendiente visit', async () => {
    createFakeDb({ visits: () => ({ data: makeVisit('pendiente') }) })
    const photo = Buffer.alloc(100)
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(photo)

    await expect(
      applyDelivered(ctx, {
        samples: [freshSample(1000), freshSample(2000)],
        radiusMeters: 200,
        kinship: 'titular',
        photo,
      })
    ).rejects.toMatchObject({ code: 'WRONG_STATUS' })
  })

  it('rejects a delivery when outside the customer radius', async () => {
    createFakeDb({
      visits: () => ({
        data: { ...makeVisit('en_ubicacion'), customer_lat: -34.6037, customer_lng: -58.3816 },
      }),
      orders: () => ({ data: makeOrder() }),
    })
    const photo = Buffer.alloc(100)
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]).copy(photo)

    await expect(
      applyDelivered(ctx, {
        samples: [
          { lat: -34.5, lng: -58.5, capturedAt: freshSample(1000).capturedAt },
          { lat: -34.5, lng: -58.5, capturedAt: freshSample(2000).capturedAt },
        ],
        radiusMeters: 200,
        kinship: 'titular',
        photo,
      })
    ).rejects.toMatchObject({ code: 'GPS_REJECTED' })
  })
})
