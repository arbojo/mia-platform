import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      ok: (init?.status ?? 200) < 400,
      body,
      async json() {
        return body
      },
    }),
  },
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/delivery/admin-api', () => ({
  requireDeliveryAdmin: vi.fn(),
}))

vi.mock('@/lib/delivery/licensing', () => ({
  assertDeliveryEditionAvailable: vi.fn(),
}))

import { GET as schedulesGET, PUT as schedulesPUT, DELETE as schedulesDELETE } from '@/app/api/admin/delivery/schedules/route'
import { GET as overridesGET, POST as overridesPOST, DELETE as overridesDELETE } from '@/app/api/admin/delivery/overrides/route'
import { DeliveryError } from '@/lib/delivery/errors'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireDeliveryAdmin } from '@/lib/delivery/admin-api'
import { assertDeliveryEditionAvailable } from '@/lib/delivery/licensing'

const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'

function makeAdminChain(rows: unknown[]) {
  const wrapper: Record<string, unknown> = { data: rows, error: null }
  for (const method of ['select', 'eq', 'order', 'gte', 'upsert', 'insert', 'update', 'delete', 'single']) {
    wrapper[method] = vi.fn(() => wrapper)
  }
  wrapper.single = vi.fn(() => ({ data: rows[0] ?? null, error: null }))
  return { from: vi.fn(() => wrapper), wrapper }
}

const mCreateAdminClient = vi.mocked(createAdminClient)
const mRequireDeliveryAdmin = vi.mocked(requireDeliveryAdmin)
const mAssertEdition = vi.mocked(assertDeliveryEditionAvailable)

beforeEach(() => {
  vi.clearAllMocks()
  mRequireDeliveryAdmin.mockResolvedValue({ userId: 'user-1', businessId: BUSINESS_ID })
  mAssertEdition.mockResolvedValue()
})

function url(path: string): NextRequest {
  return new Request(`http://localhost${path}`, {}) as unknown as NextRequest
}

function request(path: string, init: RequestInit): NextRequest {
  return new Request(`http://localhost${path}`, init) as unknown as NextRequest
}

describe('GET /api/admin/delivery/schedules', () => {
  it('devuelve schedules y overrides activos', async () => {
    const chain = makeAdminChain([])
    const { from, wrapper } = chain
    mCreateAdminClient.mockReturnValue(chain as never)

    const res = await schedulesGET(url(`/api/admin/delivery/schedules?business_id=${BUSINESS_ID}`))
    const body = (await res.json()) as { schedules: unknown[]; overrides: unknown[] }

    expect(body.schedules).toEqual([])
    expect(body.overrides).toEqual([])
    expect(from).toHaveBeenCalledWith('delivery_schedules')
    expect(from).toHaveBeenCalledWith('delivery_schedule_overrides')
    expect(wrapper.gte).toHaveBeenCalled()
  })

  it('rechaza sin business_id', async () => {
    mRequireDeliveryAdmin.mockRejectedValueOnce(
      new DeliveryError('INVALID_INPUT', 'business_id es requerido', 400)
    )
    const res = await schedulesGET(url('/api/admin/delivery/schedules'))
    expect(res.status).toBe(400)
  })
})

describe('PUT /api/admin/delivery/schedules', () => {
  it('crea/actualiza un calendario base por ciudad', async () => {
    const schedule = {
      id: 'aaa00000-0000-0000-0000-000000000001',
      business_id: BUSINESS_ID,
      city: 'Aguascalientes',
      delivery_days: [2, 4, 6],
      delivery_window_start: '09:00:00',
      delivery_window_end: '19:00:00',
    }
    const chain = makeAdminChain([schedule])
    mCreateAdminClient.mockReturnValue(chain as never)

    const res = await schedulesPUT(
      request(`/api/admin/delivery/schedules?business_id=${BUSINESS_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: 'Aguascalientes',
          delivery_days: [2, 4, 6],
          delivery_window_start: '09:00',
          delivery_window_end: '19:00',
        }),
      })
    )
    const body = (await res.json()) as { schedule: typeof schedule }

    expect(res.status).toBe(200)
    expect(body.schedule.city).toBe('Aguascalientes')
    expect(chain.wrapper.upsert).toHaveBeenCalled()
  })

  it('rechaza días de entrega inválidos', async () => {
    const res = await schedulesPUT(
      request(`/api/admin/delivery/schedules?business_id=${BUSINESS_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: 'X', delivery_days: [9] }),
      })
    )
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/admin/delivery/schedules', () => {
  it('elimina un calendar por id', async () => {
    const chain = makeAdminChain([])
    mCreateAdminClient.mockReturnValue(chain as never)

    const res = await schedulesDELETE(
      url(`/api/admin/delivery/schedules?business_id=${BUSINESS_ID}&id=aaa00000-0000-0000-0000-000000000001`)
    )
    expect(res.status).toBe(200)
    expect(chain.wrapper.delete).toHaveBeenCalled()
  })
})

describe('GET /api/admin/delivery/overrides', () => {
  it('devuelve overrides activos', async () => {
    const chain = makeAdminChain([])
    mCreateAdminClient.mockReturnValue(chain as never)

    const res = await overridesGET(url(`/api/admin/delivery/overrides?business_id=${BUSINESS_ID}`))
    const body = (await res.json()) as { overrides: unknown[] }

    expect(body.overrides).toEqual([])
    expect(chain.from).toHaveBeenCalledWith('delivery_schedule_overrides')
  })
})

describe('POST /api/admin/delivery/overrides', () => {
  it('crea una excepción temporal', async () => {
    const override = {
      id: 'bbb00000-0000-0000-0000-000000000002',
      business_id: BUSINESS_ID,
      city: 'Aguascalientes',
      start_date: '2026-10-14',
      end_date: '2026-10-21',
      delivery_days: [3],
      delivery_window_start: '10:00:00',
      delivery_window_end: '14:00:00',
      note: 'ruta extra esta semana',
    }
    const chain = makeAdminChain([override])
    mCreateAdminClient.mockReturnValue(chain as never)

    const res = await overridesPOST(
      request(`/api/admin/delivery/overrides?business_id=${BUSINESS_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: 'Aguascalientes',
          start_date: '2026-10-14',
          end_date: '2026-10-21',
          delivery_days: [3],
          delivery_window_start: '10:00',
          delivery_window_end: '14:00',
          note: 'ruta extra esta semana',
        }),
      })
    )
    const body = (await res.json()) as { override: typeof override }

    expect(res.status).toBe(201)
    expect(body.override.city).toBe('Aguascalientes')
    expect(chain.wrapper.insert).toHaveBeenCalled()
  })

  it('rechaza rango de fechas invertido', async () => {
    const res = await overridesPOST(
      request(`/api/admin/delivery/overrides?business_id=${BUSINESS_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: 'X',
          start_date: '2026-10-21',
          end_date: '2026-10-14',
          delivery_days: [3],
        }),
      })
    )
    expect(res.status).toBe(400)
  })
})

describe('DELETE /api/admin/delivery/overrides', () => {
  it('elimina una excepción por id', async () => {
    const chain = makeAdminChain([])
    mCreateAdminClient.mockReturnValue(chain as never)

    const res = await overridesDELETE(
      url(`/api/admin/delivery/overrides?business_id=${BUSINESS_ID}&id=bbb00000-0000-0000-0000-000000000002`)
    )
    expect(res.status).toBe(200)
    expect(chain.wrapper.delete).toHaveBeenCalled()
  })
})