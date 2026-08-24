import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}))

import {
  emitSalesEvent,
  hasClosingEvent,
  applyConversationOutcome,
  notifySaleToOwner,
  getCustomerName,
} from '@/lib/sales/events'
import { createAdminClient } from '@/lib/supabase/admin'

const mockedAdmin = vi.mocked(createAdminClient)

const BUSINESS_ID = 'b0000000-0000-4000-8000-000000000002'
const CONVERSATION_ID = 'd0000000-0000-4000-8000-000000000004'
const CUSTOMER_ID = 'c0000000-0000-4000-8000-000000000003'

type StubResult = { data: unknown; error: unknown }

function makeTable(name: string) {
  const table = {
    name,
    select: vi.fn(() => table),
    insert: vi.fn((_payload: Record<string, unknown>) => table),
    update: vi.fn((_payload: Record<string, unknown>) => table),
    eq: vi.fn(() => table),
    ilike: vi.fn(() => table),
    in: vi.fn(() => table),
    limit: vi.fn(() => table),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null } as StubResult)),
    then: (resolve: (value: unknown) => unknown) =>
      resolve(Promise.resolve({ data: null, error: null } as StubResult)),
  }
  return table
}

const tables = new Map<string, ReturnType<typeof makeTable>>()

function stubTable(tableName: string, result: StubResult) {
  let table = tables.get(tableName)
  if (!table) {
    table = makeTable(tableName)
    tables.set(tableName, table)
  }
  table.maybeSingle = vi.fn(() => Promise.resolve(result))
  table.then = (resolve: (value: unknown) => unknown) => resolve(Promise.resolve(result))
  return table
}

beforeEach(() => {
  vi.clearAllMocks()
  tables.clear()
  mockedAdmin.mockReturnValue({
    from: vi.fn((name: string) => {
      let table = tables.get(name)
      if (!table) {
        table = makeTable(name)
        tables.set(name, table)
      }
      return table
    }),
  } as never)
})

describe('emitSalesEvent', () => {
  it('inserta evento sin producto', async () => {
    const table = stubTable('sales_events', { data: null, error: null })
    await emitSalesEvent({
      businessId: BUSINESS_ID,
      eventType: 'SALE_STARTED',
      conversationId: CONVERSATION_ID,
    })
    expect(table.insert).toHaveBeenCalledTimes(1)
    const [payload] = table.insert.mock.calls[0]
    expect(payload.business_id).toBe(BUSINESS_ID)
    expect(payload.event_type).toBe('SALE_STARTED')
    expect(payload.product_id).toBeNull()
    expect(payload.metadata).toEqual({})
  })

  it('resuelve product_id cuando existe el producto', async () => {
    const products = stubTable('products', { data: { id: 'p-1' }, error: null })
    const table = stubTable('sales_events', { data: null, error: null })
    await emitSalesEvent({
      businessId: BUSINESS_ID,
      eventType: 'PRODUCT_SELECTED',
      productName: 'Bota de Cuero',
    })
    expect(products.ilike).toHaveBeenCalledWith('name', 'Bota de Cuero')
    const [payload] = table.insert.mock.calls[0]
    expect(payload.product_id).toBe('p-1')
    expect((payload.metadata as { product_name: string }).product_name).toBe('Bota de Cuero')
  })

  it('no resuelve product_id cuando el producto no existe', async () => {
    const table = stubTable('sales_events', { data: null, error: null })
    stubTable('products', { data: null, error: null })
    await emitSalesEvent({
      businessId: BUSINESS_ID,
      eventType: 'PRODUCT_SELECTED',
      productName: 'Inexistente',
    })
    const [payload] = table.insert.mock.calls[0]
    expect(payload.product_id).toBeNull()
  })
})

describe('hasClosingEvent', () => {
  it('devuelve true cuando existe evento de cierre', async () => {
    stubTable('sales_events', { data: { id: 'e-1' }, error: null })
    expect(await hasClosingEvent(CONVERSATION_ID)).toBe(true)
  })

  it('devuelve false cuando no existe', async () => {
    stubTable('sales_events', { data: null, error: null })
    expect(await hasClosingEvent(CONVERSATION_ID)).toBe(false)
  })
})

describe('applyConversationOutcome', () => {
  it('actualiza la conversacion y el historial', async () => {
    const conversations = stubTable('conversations', {
      data: {
        outcome: null,
        deal_value: null,
        outcome_history: null,
        customer_id: CUSTOMER_ID,
      },
      error: null,
    })
    stubTable('customers', { data: null, error: null })

    await applyConversationOutcome({
      conversationId: CONVERSATION_ID,
      outcome: 'sold',
      dealValue: 150,
      eventType: 'SALE_WON',
    })

    expect(conversations.update).toHaveBeenCalledTimes(1)
    const [payload] = conversations.update.mock.calls[0]
    expect(payload.outcome).toBe('sold')
    expect(payload.deal_value).toBe(150)
    expect(payload.outcome_history).toHaveLength(1)
    expect((payload.outcome_history as Array<{ event_type: string }>)[0].event_type).toBe('SALE_WON')
  })

  it('no re-escribe outcome cuando ya esta sold', async () => {
    const conversations = stubTable('conversations', {
      data: {
        outcome: 'sold',
        deal_value: 100,
        outcome_history: [],
        customer_id: CUSTOMER_ID,
      },
      error: null,
    })

    await applyConversationOutcome({
      conversationId: CONVERSATION_ID,
      outcome: 'sold',
    })

    expect(conversations.update).not.toHaveBeenCalled()
  })

  it('actualiza el status del customer segun outcome', async () => {
    stubTable('conversations', {
      data: { outcome: null, deal_value: null, outcome_history: [], customer_id: CUSTOMER_ID },
      error: null,
    })
    const customers = stubTable('customers', { data: null, error: null })

    await applyConversationOutcome({
      conversationId: CONVERSATION_ID,
      outcome: 'not_interested',
      customerId: CUSTOMER_ID,
    })

    expect(customers.update).toHaveBeenCalledTimes(1)
    expect(customers.update.mock.calls[0][0]).toEqual({ status: 'lost' })
  })

  it('propaga el error cuando falla el update de la conversacion', async () => {
    stubTable('conversations', { data: null, error: { message: 'CHECK constraint violated' } })

    await expect(
      applyConversationOutcome({
        conversationId: CONVERSATION_ID,
        outcome: 'interested',
      })
    ).rejects.toThrow('Failed to persist conversation outcome')
  })

  it('propaga el error cuando falla la sincronizacion del customer', async () => {
    stubTable('conversations', {
      data: { outcome: null, deal_value: null, outcome_history: [], customer_id: CUSTOMER_ID },
      error: null,
    })
    stubTable('customers', { data: null, error: { message: 'db write failed' } })

    await expect(
      applyConversationOutcome({
        conversationId: CONVERSATION_ID,
        outcome: 'sold',
        customerId: CUSTOMER_ID,
      })
    ).rejects.toThrow('Failed to sync customer status from outcome')
  })
})

describe('emitSalesEvent — errores', () => {
  it('propaga el error cuando falla el insert del evento', async () => {
    const table = stubTable('sales_events', { data: null, error: { message: 'insert failed' } })

    await expect(
      emitSalesEvent({ businessId: BUSINESS_ID, eventType: 'SALE_WON' })
    ).rejects.toThrow('Failed to emit sales event SALE_WON')
    expect(table.insert).toHaveBeenCalledTimes(1)
  })
})

describe('notifySaleToOwner', () => {
  it('inserta senal para venta ganada', async () => {
    const table = stubTable('mia_signals', { data: null, error: null })
    await notifySaleToOwner({
      businessId: BUSINESS_ID,
      customerName: ' Ana ',
      amount: 200,
      productName: 'Botas',
      outcome: 'won',
      conversationId: CONVERSATION_ID,
    })
    expect(table.insert).toHaveBeenCalledTimes(1)
    const [payload] = table.insert.mock.calls[0]
    expect(payload.priority).toBe('atencion')
    expect(payload.title).toBe('Nuevo pedido confirmado')
    expect(payload.message).toContain('Ana')
    expect(payload.action_available).toBe('open_conversation')
    expect((payload.action_payload as { conversation_id: string }).conversation_id).toBe(CONVERSATION_ID)
  })

  it('usa nombre por defecto cuando no hay customerName', async () => {
    const table = stubTable('mia_signals', { data: null, error: null })
    await notifySaleToOwner({
      businessId: BUSINESS_ID,
      outcome: 'lost',
    })
    const [payload] = table.insert.mock.calls[0]
    expect(payload.message).toContain('Cliente')
    expect(payload.priority).toBe('info')
  })
})

describe('getCustomerName', () => {
  it('devuelve el nombre del customer', async () => {
    stubTable('customers', { data: { name: 'Juan' }, error: null })
    expect(await getCustomerName(CUSTOMER_ID)).toBe('Juan')
  })

  it('devuelve null cuando no existe', async () => {
    stubTable('customers', { data: null, error: null })
    expect(await getCustomerName(CUSTOMER_ID)).toBeNull()
  })
})
