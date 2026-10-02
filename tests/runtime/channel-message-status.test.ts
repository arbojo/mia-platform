import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─────────────────────────────────────────────────────────────────────────────
//ESTADOS DE channel_messages: UNA POLITICA, NO UN ESTADO
// ─────────────────────────────────────────────────────────────────────────────
// Dos invariantes que este archivo fija:
//
//  1. Shadow NO usa 'processing'. Nada en el codebase actualiza channel_messages
//     despues del insert, asi que el status escrito es el que la fila tiene para
//     siempre. Con 'processing' como terminal de shadow, 12 respuestas
//     correctamente suprimidas quedaron indistinguibles de una entrega atascada.
//     Shadow y active escriben el mismo status; la entrega suprimida vive solo en
//     metadata. Borra 'processing' de este archivo y el shadow vuelve a mentir.
//
//  2. La deduplicacion (Capa 2) corre ANTES de cualquier rama que persiste. La
//     rama fromHuman escribia en `messages` sin check previo, y el catch de 23505
//     sobre channel_messages llega tarde: protege el segundo insert, no el
//     primero. Un mensaje humano duplicado dejaba fila huerfana en `messages`.
// ─────────────────────────────────────────────────────────────────────────────

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/channels/identity', () => ({ resolveCustomer: vi.fn() }))
vi.mock('@/lib/conversation/context', () => ({ loadConversationContext: vi.fn() }))
vi.mock('@/lib/runtime/execute-ai', () => ({ executeAI: vi.fn() }))
vi.mock('@/lib/conversation/resolver', () => ({
  resolveConnection: vi.fn(),
  resolveConversation: vi.fn(),
}))
vi.mock('@/lib/runtime/intents', () => ({
  detectIntent: vi.fn(() => null),
  buildInteractiveForIntent: vi.fn(() => null),
}))
vi.mock('@/lib/sales/process', () => ({
  processSaleClosing: vi.fn(),
  isDiscountOfferSentinel: vi.fn(() => false),
}))
vi.mock('@/lib/sales/intent-classifier', () => ({
  classifyUserIntent: vi.fn(() => null),
}))
vi.mock('@/lib/runtime/media', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/runtime/media')>()),
  isResendRequest: vi.fn(() => false),
}))
vi.mock('@/lib/runtime/media-guard', () => ({ isSafeMediaUrl: vi.fn(() => true) }))
vi.mock('@/lib/runtime/product-recommendation', () => ({
  resolveRecommendedProduct: vi.fn(() => null),
}))
vi.mock('@/lib/runtime/evidence-extraction', () => ({
  extractEvidenceFromCustomerMessage: vi.fn(),
}))
vi.mock('@/lib/runtime/core', () => ({
  processCore: vi.fn(() =>
    Promise.resolve({
      response: 'Respuesta de MIA.',
      textStream: null,
      product: null,
      media: null,
      metadata: { retention: false },
    })
  ),
}))

import { processIncomingMessage } from '@/lib/runtime/runtime'
import { resolveCustomer } from '@/lib/channels/identity'
import { loadConversationContext } from '@/lib/conversation/context'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveConnection, resolveConversation } from '@/lib/conversation/resolver'
import { processCore } from '@/lib/runtime/core'
import { allowsSideEffects } from '@/lib/channels/mode'
import { FAKE_UUIDS, mockWireMessage } from '../fixtures'

type Row = Record<string, unknown>

/**
 * maybeSingle has to answer two different queries that both select('id'): the
 * Capa 2 duplicate check (null = not a duplicate) and the outgoing insert's
 * `.select('id')` (a row id). The chain is shared, so the mock tracks whether
 * an insert happened since the last select — that is what tells the two apart.
 */
function makeSupabaseMock(outgoingId: string | null = 'row-id-1') {
  const chain: Record<string, unknown> = {}
  const mockUpdate = vi.fn(() => chain)
  // `.insert(...).select('id').maybeSingle()` is the returning-insert shape;
  // `.select('id').eq(...)...maybeSingle()` is the duplicate-check shape. Both
  // select the same column, so the only distinguishing signal is whether an
  // insert opened this chain.
  let lastOp: 'insert' | 'other' = 'other'
  let selectFollowsInsert = false

  const mockInsert = vi.fn((..._args: unknown[]) => {
    lastOp = 'insert'
    return chain
  })
  const mockSelect = vi.fn(() => {
    selectFollowsInsert = lastOp === 'insert'
    lastOp = 'other'
    return chain
  })
  const mockMaybeSingle = vi.fn(() => {
    const isReturningInsert = selectFollowsInsert
    selectFollowsInsert = false
    return Promise.resolve({
      data: isReturningInsert && outgoingId ? { id: outgoingId } : null,
      error: null,
    })
  })

  Object.assign(chain, {
    insert: mockInsert,
    select: mockSelect,
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    not: vi.fn(() => chain),
    update: mockUpdate,
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: mockMaybeSingle,
    contains: vi.fn(() => chain),
  })

  const supabase = { from: vi.fn(() => chain) }
  return { supabase, mockInsert, chain, mockMaybeSingle }
}

/** Primera columna de cada llamada insert(): la fila insertada. */
function insertedRows(mockInsert: ReturnType<typeof vi.fn>): Row[] {
  return mockInsert.mock.calls
    .map((call) => call[0])
    .filter((row): row is Row => typeof row === 'object' && row !== null)
}

/** Filas insertadas en channel_messages, en orden de aparicion. */
function channelRows(mockInsert: ReturnType<typeof vi.fn>): Row[] {
  return insertedRows(mockInsert).filter(
    (row) => row.channel !== undefined && row.direction !== undefined
  )
}

/** Filas insertadas en messages. */
function messageRows(mockInsert: ReturnType<typeof vi.fn>): Row[] {
  return insertedRows(mockInsert).filter((row) => row.role !== undefined)
}

function outgoingRow(mockInsert: ReturnType<typeof vi.fn>): Row | undefined {
  return channelRows(mockInsert).find((row) => row.direction === 'outgoing')
}

async function run(mode: 'active' | 'shadow', wire = mockWireMessage) {
  const { supabase, mockInsert } = makeSupabaseMock()
  vi.mocked(createAdminClient).mockReturnValue(supabase as never)
  vi.mocked(resolveConnection).mockResolvedValue({
    business_id: FAKE_UUIDS.business,
    assistant_id: FAKE_UUIDS.assistant,
    mode,
  })

  const result = await processIncomingMessage('whatsapp', wire, {} as never)
  return { result, mockInsert }
}

beforeEach(() => {
  vi.clearAllMocks()

  vi.mocked(resolveConnection).mockResolvedValue({
    business_id: FAKE_UUIDS.business,
    assistant_id: FAKE_UUIDS.assistant,
    mode: 'active',
  })
  vi.mocked(resolveConversation).mockResolvedValue(FAKE_UUIDS.conversation)

  vi.mocked(loadConversationContext).mockResolvedValue({
    systemPrompt: 'Eres un asistente.',
    usedContext: [],
    fullAssistant: { id: FAKE_UUIDS.assistant },
    businessId: FAKE_UUIDS.business,
    assistantId: FAKE_UUIDS.assistant,
  })

  vi.mocked(resolveCustomer).mockResolvedValue({
    id: FAKE_UUIDS.customer,
    businessId: FAKE_UUIDS.business,
    name: 'Raymundo',
    phone: null,
    email: null,
    isNew: false,
  })
})

describe('shadow escribe un status terminal, no uno transitorio', () => {
  it('shadow NO escribe status=processing en la respuesta outgoing', async () => {
    const { mockInsert } = await run('shadow')

    const row = outgoingRow(mockInsert)
    expect(row).toBeDefined()
    expect(row?.status).not.toBe('processing')
  })

  it('shadow escribe un status ya terminal, con sent_at presente', async () => {
    const { mockInsert } = await run('shadow')

    const row = outgoingRow(mockInsert)
    expect(row?.status).toBe('sent')
    expect(row?.sent_at).toEqual(expect.any(String))
  })

  it('shadow registra la supresion solo en metadata', async () => {
    const { mockInsert } = await run('shadow')

    const metadata = outgoingRow(mockInsert)?.metadata as Record<string, unknown>
    expect(metadata).toMatchObject({ shadow: true, delivered: false })
  })

  it('shadow igual no entrega: deliver=false y sin efectos secundarios', async () => {
    const { result } = await run('shadow')

    expect(result.deliver).toBe(false)
    expect(allowsSideEffects('shadow')).toBe(false)
  })

  it('active escribe processing: la fila espera confirmacion del bridge', async () => {
    const { mockInsert } = await run('active')

    const row = outgoingRow(mockInsert)
    // Antes el runtime escribia 'sent' aqui, antes de que WhatsApp hubiera
    // aceptado nada: un sendMessage fallido dejaba la fila diciendo 'sent' para
    // siempre. Ahora `processing` significa "envío en vuelo de verdad" y solo
    // el bridge lo promote con un receipt real.
    expect(row?.status).toBe('processing')
    expect(row?.sent_at).toBeNull()
    expect(row?.metadata).toEqual({})
  })

it('shadow y active NO comparten status: cada modo refleja la verdad del envio', async () => {
    const shadow = outgoingRow((await run('shadow')).mockInsert)
    const active = outgoingRow((await run('active')).mockInsert)

    // Shadow ya esta terminal porque no habra envio. Active sigue en vuelo. Lo
    // que no puede pasar es que shadow quede en un estado transitorio: ahi es
    // donde se leyo "atascado" lo que en realidad era una supresion.
    expect(shadow?.status).toBe('sent')
    expect(active?.status).toBe('processing')
    expect(shadow?.metadata).not.toEqual(active?.metadata)
  })
})

describe('el bridge recibe el id para reportar el resultado', () => {
  it('active devuelve outgoingMessageId para que el bridge confirme', async () => {
    const { result } = await run('active')

    expect(result.deliver).toBe(true)
    expect(result.outgoingMessageId).toBe('row-id-1')
  })

  it('shadow NO devuelve outgoingMessageId: no hay nada que confirmar', async () => {
    const { result } = await run('shadow')

    expect(result.deliver).toBe(false)
    expect(result.outgoingMessageId).toBeUndefined()
  })

  it('sin id de fila no inventa uno: el bridge simplemente no reporta', async () => {
    const { supabase, chain } = makeSupabaseMock()
    // maybeSingle devuelve null tambien para el insert: no hay id que reportar.
    ;(chain.maybeSingle as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: null,
      error: null,
    })
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)
    vi.mocked(resolveConnection).mockResolvedValue({
      business_id: FAKE_UUIDS.business,
      assistant_id: FAKE_UUIDS.assistant,
      mode: 'active',
    })

    const result = await processIncomingMessage('whatsapp', mockWireMessage, {} as never)

    expect(result.deliver).toBe(true)
    expect(result.outgoingMessageId).toBeUndefined()
  })
})

describe('deduplicacion antes de persistir (Capa 2)', () => {
  function mockDuplicateFound(supabase: ReturnType<typeof vi.fn>) {
    const existing = { data: { id: 'existing-id' }, error: null }
    ;(supabase as unknown as { maybeSingle: ReturnType<typeof vi.fn> }).maybeSingle = vi.fn(
      () => Promise.resolve(existing)
    )
    return existing
  }

  it('un duplicado NO inserta nada en messages', async () => {
    const { supabase, mockInsert, chain } = makeSupabaseMock()
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)
    mockDuplicateFound(chain as never)

    const wire = { ...mockWireMessage, externalId: 'dupe-1', fromHuman: true }
    const result = await processIncomingMessage('whatsapp', wire, {} as never)

    expect(messageRows(mockInsert)).toHaveLength(0)
    expect(channelRows(mockInsert)).toHaveLength(0)
    expect(result.response).toBe('')
    expect(result.deliver).toBe(false)
  })

  it('un duplicado humano NO llama al Core', async () => {
    const { supabase, chain } = makeSupabaseMock()
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)
    mockDuplicateFound(chain as never)

    const wire = { ...mockWireMessage, externalId: 'dupe-2' }
    await processIncomingMessage('whatsapp', wire, {} as never)

    expect(processCore).not.toHaveBeenCalled()
  })

  it('un duplicado humano NO actualiza last_interaction', async () => {
    const { supabase, chain } = makeSupabaseMock()
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)
    mockDuplicateFound(chain as never)

    const wire = { ...mockWireMessage, externalId: 'dupe-3', fromHuman: true }
    await processIncomingMessage('whatsapp', wire, {} as never)

    expect((chain.update as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled()
  })

  it('un mensaje humano nuevo SI se persiste (el check no lo bloquea)', async () => {
    // maybeSingle por defecto devuelve { data: null }: no hay duplicado.
    const { supabase, mockInsert } = makeSupabaseMock()
    vi.mocked(createAdminClient).mockReturnValue(supabase as never)

    const wire = { ...mockWireMessage, externalId: 'nuevo-1', fromHuman: true }
    const result = await processIncomingMessage('whatsapp', wire, {} as never)

    expect(result.response).toBe('')
    expect(result.deliver).toBe(false)
    expect(processCore).not.toHaveBeenCalled()
    // La vendedora se guarda para aprendizaje, nunca como mensaje de cliente.
    expect(messageRows(mockInsert)).toHaveLength(1)
    expect(messageRows(mockInsert)[0]).toMatchObject({ role: 'assistant' })
    const persisted = channelRows(mockInsert)
    expect(persisted).toHaveLength(1)
    expect(persisted[0]).toMatchObject({ direction: 'incoming', status: 'received' })
  })

  it('sin external_id no hay deduplicacion posible (no se cuelga)', async () => {
    const { result } = await run('shadow', {
      ...mockWireMessage,
      externalId: undefined as unknown as string,
    })

    expect(result.deliver).toBe(false)
  })
})