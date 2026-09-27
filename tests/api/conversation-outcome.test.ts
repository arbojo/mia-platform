import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Regresion de tenant en PATCH /api/conversations/[id]/outcome.
 *
 * El bug que se cubre aqui no era de validacion: el route pedia
 * `conversations.business_id`, columna que no existe. PostgREST respondia
 * 42703, el route leia `data` (null) y contestaba 404, con lo que ningun
 * outcome se podia registrar. Como el error se ignoraba, el endpoint parecia
 * sano y solo fallaba en produccion.
 *
 * El fake de admin reproduce el comportamiento real de PostgREST en vez de
 * devolver una fixture fija: valida las columnas pedidas y solo construye un
 * embed anidado cuando la relacion existe. Si alguien revierte el fix, el
 * select vuelve a pedir business_id, el fake devuelve 42703 y el test falla
 * por la razon correcta.
 */

vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      body,
      async json() {
        return body
      },
    }),
  },
  NextRequest: class {},
}))

vi.mock('@/lib/auth', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/sales/events', () => ({ applyConversationOutcome: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/api-error', () => ({
  handleApiError: (err: unknown) => ({
    status: 500,
    body: { error: String(err) },
    async json() {
      return { error: String(err) }
    },
  }),
}))

import { PATCH } from '@/app/api/conversations/[id]/outcome/route'
import { requireAuth } from '@/lib/auth'
import { applyConversationOutcome } from '@/lib/sales/events'
import { createAdminClient } from '@/lib/supabase/admin'

const mockedRequireAuth = vi.mocked(requireAuth)
const mockedApplyOutcome = vi.mocked(applyConversationOutcome)
const mockedCreateAdmin = vi.mocked(createAdminClient)

/** Columnas reales de public.conversations. Notablemente sin business_id. */
const CONVERSATION_COLUMNS = new Set([
  'id',
  'assistant_id',
  'customer_id',
  'status',
  'type',
  'assigned_to',
  'handover_reason',
  'notes',
  'outcome',
  'created_at',
  'updated_at',
])

/** public.assistants tiene business_id, y conversations apunta a el por FK. */
const ASSISTANT_COLUMNS = new Set(['id', 'business_id', 'name', 'is_active'])

const CONVERSATION_ID = 'conv-1'
const OWNER = 'business-dueno'
const OTHER = 'business-ajeno'

let callerBusinesses: string[]
let conversationOwner: string
let lastSelect: string | undefined

type SelectResult = { data: unknown; error: { code: string; message: string } | null }

/**
 * Replica lo que hace PostgREST con un `select`:
 * - columna simple: debe existir, si no 42703
 * - `rel!inner(col)`: anida en `{ rel: { col } }` porque la relacion existe
 * - `alias:rel!inner(col)`: anida en `{ alias: { col } }`. No aplana, y por eso
 *   leer `conv.business_id` daria un objeto en vez del id.
 */
function runSelect(select: string): SelectResult {
  lastSelect = select
  const row: Record<string, unknown> = {}

  for (const rawItem of select.split(',')) {
    const item = rawItem.trim()
    if (!item) continue

    if (item === '*') {
      for (const column of CONVERSATION_COLUMNS) row[column] = CONVERSATION_ID
      continue
    }

    if (item.includes('(') || item.includes('!') || item.includes(':')) {
      const embed = item.match(/^(?:(\w+):)?(\w+)(?:!\w+\()?\(?(\w+)\)?$/)
      if (!embed) {
        return { data: null, error: { code: 'PGRST100', message: `parse error: ${item}` } }
      }
      const [, alias, relation, column] = embed
      if (relation !== 'assistants' || !ASSISTANT_COLUMNS.has(column)) {
        return { data: null, error: { code: 'PGRST200', message: `relation not found: ${item}` } }
      }
      row[alias ?? relation] = {
        [column]: column === 'business_id' ? conversationOwner : 'assistant-1',
      }
      continue
    }

    if (!CONVERSATION_COLUMNS.has(item)) {
      return {
        data: null,
        error: { code: '42703', message: `column conversations.${item} does not exist` },
      }
    }
    row[item] = CONVERSATION_ID
  }

  return { data: row, error: null }
}

function installAdmin(result: SelectResult = { data: null, error: null }) {
  const chain = {
    select: vi.fn((columns: string) => {
      chain.result = runSelect(columns)
      return chain
    }),
    result,
    eq: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => chain.result),
  }
  mockedCreateAdmin.mockReturnValue({ from: vi.fn(() => chain) } as never)
}

function patch(outcome: unknown, id: string = CONVERSATION_ID) {
  const request = new Request('http://localhost/api/conversations/x/outcome', {
    method: 'PATCH',
    body: JSON.stringify({ outcome }),
  })
  return PATCH(request as never, { params: Promise.resolve({ id }) })
}

beforeEach(() => {
  vi.clearAllMocks()
  lastSelect = undefined
  // Por defecto el caller es el dueño de la conversación: los casos felices.
  callerBusinesses = [OWNER]
  conversationOwner = OWNER

  mockedRequireAuth.mockResolvedValue({
    user: { id: 'user-1' },
    supabase: { rpc: vi.fn(async () => ({ data: callerBusinesses, error: null })) },
  } as never)
  mockedApplyOutcome.mockResolvedValue(undefined as never)
  installAdmin()
})

describe('PATCH /api/conversations/[id]/outcome — tenant scope', () => {
  it('alcanza el tenant por assistants, no por una columna business_id inexistente', async () => {
    await patch('sold')

    expect(lastSelect).toContain('assistants!inner(business_id)')
    expect(lastSelect).not.toMatch(/(^|,\s*)business_id(\s*,|$)/)
  })

  it('registra SALE_WON cuando la conversación es del tenant del caller', async () => {
    const res = await patch('sold')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true })
    expect(mockedApplyOutcome).toHaveBeenCalledWith({
      conversationId: CONVERSATION_ID,
      outcome: 'sold',
      eventType: 'SALE_WON',
    })
  })

  it('rechaza con 403 una conversación de otro tenant y no toca los eventos', async () => {
    callerBusinesses = [OTHER]
    conversationOwner = OWNER

    const res = await patch('sold')

    expect(res.status).toBe(403)
    expect((await res.json()).error).toBe('No autorizado')
    expect(mockedApplyOutcome).not.toHaveBeenCalled()
  })

  it('acepta cuando el caller tiene varios negocios y uno es el dueño', async () => {
    callerBusinesses = [OTHER, OWNER]

    const res = await patch('sold')

    expect(res.status).toBe(200)
    expect(mockedApplyOutcome).toHaveBeenCalledOnce()
  })

  it('mapea not_interested a SALE_LOST y no manda eventType en los demás', async () => {
    await patch('not_interested')
    expect(mockedApplyOutcome).toHaveBeenLastCalledWith({
      conversationId: CONVERSATION_ID,
      outcome: 'not_interested',
      eventType: 'SALE_LOST',
    })

    await patch('needs_follow_up')
    expect(mockedApplyOutcome).toHaveBeenLastCalledWith({
      conversationId: CONVERSATION_ID,
      outcome: 'needs_follow_up',
      eventType: undefined,
    })
  })

  it('valida el outcome contra la lista antes de tocar la base', async () => {
    const res = await patch('cancelled')

    expect(res.status).toBe(400)
    expect(mockedApplyOutcome).not.toHaveBeenCalled()
  })

  it('devuelve 404 cuando la conversación no existe', async () => {
    const chain = {
      select: vi.fn(() => chain),
      result: { data: null, error: null } as SelectResult,
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => chain.result),
    }
    mockedCreateAdmin.mockReturnValue({ from: vi.fn(() => chain) } as never)

    const res = await patch('sold')

    expect(res.status).toBe(404)
    expect(mockedApplyOutcome).not.toHaveBeenCalled()
  })

  it('devuelve 404 si el select vuelve a pedir una columna inexistente', async () => {
    // Simula el fix revertido: business_id directo en conversations, que
    // PostgREST rechaza con 42703.
    const chain = {
      select: vi.fn(() => chain),
      result: {
        data: null,
        error: { code: '42703', message: 'column conversations.business_id does not exist' },
      } as SelectResult,
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(async () => chain.result),
    }
    mockedCreateAdmin.mockReturnValue({ from: vi.fn(() => chain) } as never)

    const res = await patch('sold')

    // El route no revienta: lee data null y responde 404. Ese fue el modo de
    // fallo silencioso en produccion, asi que un 404 aqui es la senal de que
    // el scope volvio a estar roto.
    expect(res.status).toBe(404)
    expect(mockedApplyOutcome).not.toHaveBeenCalled()
  })
})
