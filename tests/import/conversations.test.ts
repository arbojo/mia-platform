import { describe, it, expect } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  importConversations,
  previewConversations,
  DEFAULT_BATCH_SIZE,
} from '@/lib/import/conversations'
import type { ConversationMessageInput } from '@/lib/import/conversations/types'

const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'

interface AdminMockOptions {
  existingExternalIds?: string[]
  insertErrors?: Array<Error | null>
}

function createAdminMock(options: AdminMockOptions = {}) {
  const insertedBatches: unknown[][] = []
  const inFilters: string[][] = []
  const errorQueue = [...(options.insertErrors ?? [])]
  let pending: 'select' | 'insert' = 'select'

  const wrapper: Record<string, unknown> = {}
  wrapper.then = (onFulfilled: (value: unknown) => unknown) => {
    const result =
      pending === 'insert'
        ? (() => {
            const error = errorQueue.shift() ?? null
            return error ? { data: null, error } : { data: null, error: null }
          })()
        : {
            data: (options.existingExternalIds ?? []).map((id) => ({ external_id: id })),
            error: null,
          }
    pending = 'select'
    return Promise.resolve(result).then(onFulfilled)
  }

  wrapper.select = () => wrapper
  wrapper.eq = () => wrapper
  wrapper.in = (_column: string, values: string[]) => {
    inFilters.push(values)
    return wrapper
  }
  wrapper.insert = (rows: unknown[]) => {
    insertedBatches.push(rows)
    pending = 'insert'
    return wrapper
  }

  const admin = { from: () => wrapper } as unknown as SupabaseClient
  return { admin, insertedBatches, inFilters }
}

function message(
  overrides: Partial<ConversationMessageInput> = {}
): ConversationMessageInput {
  return {
    businessId: BUSINESS_ID,
    channel: 'whatsapp',
    direction: 'incoming',
    content: '¿Qué costo tiene?',
    contentType: 'text',
    externalId: 'harvest:aaaa1111',
    externalCustomerId: '5215500000000',
    customerId: null,
    receivedAt: '2026-06-02T19:49:00Z',
    sentAt: null,
    status: 'received',
    authorLabel: 'customer',
    metadata: {},
    ...overrides,
  } as ConversationMessageInput
}

describe('conversationMessageSchema', () => {
  it('rechaza un customer_id informado', async () => {
    const { admin } = createAdminMock()
    const result = await previewConversations({
      messages: [message({ customerId: 'cualquier-uuid' as unknown as null })],
      businessId: BUSINESS_ID,
      channel: 'whatsapp',
      admin,
    })
    expect(result.counts.invalid).toBe(1)
    expect(result.counts.valid).toBe(0)
  })

  it('rechaza external_customer_id no numerico', async () => {
    const { admin } = createAdminMock()
    const result = await previewConversations({
      messages: [message({ externalCustomerId: '5214-abc' })],
      businessId: BUSINESS_ID,
      channel: 'whatsapp',
      admin,
    })
    expect(result.counts.invalid).toBe(1)
  })

  it('rechaza contenido vacio y business_id no uuid', async () => {
    const { admin } = createAdminMock()
    const result = await previewConversations({
      messages: [message({ content: '   ' }), message({ businessId: 'nope' })],
      businessId: BUSINESS_ID,
      channel: 'whatsapp',
      admin,
    })
    expect(result.counts.invalid).toBe(2)
  })

  it('rechaza un content_type fuera del CHECK de la tabla', async () => {
    const { admin } = createAdminMock()
    const result = await previewConversations({
      messages: [
        message({ contentType: 'sticker' as unknown as 'text' }),
      ],
      businessId: BUSINESS_ID,
      channel: 'whatsapp',
      admin,
    })
    expect(result.counts.invalid).toBe(1)
  })
})

describe('previewConversations', () => {
  it('no escribe nada y desglosa autores y direcciones', async () => {
    const { admin, insertedBatches } = createAdminMock()
    const result = await previewConversations({
      messages: [
        message(),
        message({ externalId: 'harvest:bbbb2222', direction: 'outgoing', authorLabel: 'human', status: 'delivered' }),
        message({ externalId: 'harvest:cccc3333', direction: 'outgoing', authorLabel: 'bot' }),
      ],
      businessId: BUSINESS_ID,
      channel: 'whatsapp',
      admin,
    })

    expect(insertedBatches).toHaveLength(0)
    expect(result.counts.valid).toBe(3)
    expect(result.counts.inserted).toBe(0)
    expect(result.breakdown.byDirection).toEqual({ incoming: 1, outgoing: 2 })
    expect(result.breakdown.byAuthor).toEqual({ customer: 1, human: 1, bot: 1 })
    expect(result.breakdown.distinctCustomers).toBe(1)
    expect(result.breakdown.range.from).toBe('2026-06-02T19:49:00Z')
  })

  it('omite los external_id ya presentes', async () => {
    const { admin } = createAdminMock({ existingExternalIds: ['harvest:aaaa1111'] })
    const result = await previewConversations({
      messages: [message(), message({ externalId: 'harvest:dddd4444' })],
      businessId: BUSINESS_ID,
      channel: 'whatsapp',
      admin,
    })
    expect(result.counts.alreadyPresent).toBe(1)
    expect(result.breakdown.byDirection.incoming + result.breakdown.byDirection.outgoing).toBe(1)
  })
})

describe('importConversations', () => {
  it('inserta con customer_id nulo y preserva received_at', async () => {
    const { admin, insertedBatches } = createAdminMock()
    const result = await importConversations({
      messages: [message()],
      businessId: BUSINESS_ID,
      channel: 'whatsapp',
      admin,
    })

    expect(result.counts.inserted).toBe(1)
    expect(result.counts.failed).toBe(0)
    expect(insertedBatches).toHaveLength(1)

    const row = insertedBatches[0][0] as Record<string, unknown>
    expect(row.customer_id).toBeNull()
    expect(row.received_at).toBe('2026-06-02T19:49:00Z')
    expect(row.external_customer_id).toBe('5215500000000')
    expect(row.business_id).toBe(BUSINESS_ID)
    expect((row.metadata as Record<string, unknown>).author_label).toBe('customer')
  })

  it('parte el envio en lotes', async () => {
    const messages = Array.from({ length: DEFAULT_BATCH_SIZE + 5 }, (_, i) =>
      message({ externalId: `harvest:${String(i).padStart(8, '0')}` })
    )
    const { admin, insertedBatches } = createAdminMock()
    const result = await importConversations({
      messages,
      businessId: BUSINESS_ID,
      channel: 'whatsapp',
      admin,
    })

    expect(result.counts.inserted).toBe(DEFAULT_BATCH_SIZE + 5)
    expect(insertedBatches).toHaveLength(2)
    expect((insertedBatches[0] as unknown[]).length).toBe(DEFAULT_BATCH_SIZE)
    expect((insertedBatches[1] as unknown[]).length).toBe(5)
  })

  it('aísla la fila que falla dentro de un lote', async () => {
    // 1) el lote completo falla, 2) el reintento de la primera fila tambien,
    // 3-4) las otras dos filas entran.
    const { admin, insertedBatches } = createAdminMock({
      insertErrors: [
        new Error('violates unique constraint'),
        new Error('violates unique constraint'),
        null,
        null,
      ],
    })
    const result = await importConversations({
      messages: [
        message({ externalId: 'harvest:1' }),
        message({ externalId: 'harvest:2' }),
        message({ externalId: 'harvest:3' }),
      ],
      businessId: BUSINESS_ID,
      channel: 'whatsapp',
      admin,
    })

    expect(result.counts.failed).toBe(1)
    expect(result.counts.inserted).toBe(2)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].message).toContain('unique constraint')
    // 1 lote + 3 reintentos individuales
    expect(insertedBatches).toHaveLength(4)
  })

  it('reejecutar no duplica', async () => {
    const { admin } = createAdminMock({
      existingExternalIds: ['harvest:aaaa1111', 'harvest:bbbb2222'],
    })
    const result = await importConversations({
      messages: [
        message({ externalId: 'harvest:aaaa1111' }),
        message({ externalId: 'harvest:bbbb2222' }),
      ],
      businessId: BUSINESS_ID,
      channel: 'whatsapp',
      admin,
    })
    expect(result.counts.alreadyPresent).toBe(2)
    expect(result.counts.inserted).toBe(0)
  })
})