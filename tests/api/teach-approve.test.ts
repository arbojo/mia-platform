import { describe, it, expect, vi, beforeEach } from 'vitest'

const invalidatorMock = vi.hoisted(() => ({ invalidateSystemContext: vi.fn() }))

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

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/cache/invalidator', () => ({
  invalidateSystemContext: invalidatorMock.invalidateSystemContext,
}))

import { POST } from '@/app/api/laboratorio/teach/approve/route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Row = Record<string, unknown>

const USER_ID = '11111111-1111-1111-1111-111111111111'
const BUSINESS_ID = '4fb7418d-6c98-4a09-9094-4e4e4b2006a6'

function makeAdmin(event: Row, opts: { businessOwned?: boolean; messages?: Row[] } = {}) {
  const inserts: { table: string; row: Row }[] = []
  const updates: { table: string; row: Row }[] = []
  const businessOwned = opts.businessOwned ?? true
  const messages = opts.messages ?? []

  const client = {
    from(table: string) {
      const chain: Record<string, unknown> = {}

      const resultFor = (): { data: unknown; error: unknown } => {
        if (table === 'learning_events' && !('mode' in chain)) return { data: event, error: null }
        if (table === 'businesses') {
          return businessOwned ? { data: { id: BUSINESS_ID }, error: null } : { data: null, error: null }
        }
        if (table === 'channel_messages') return { data: messages, error: null }
        return { data: null, error: null }
      }

      chain.select = () => chain
      chain.eq = () => chain
      chain.not = () => chain
      chain.order = () => chain
      chain.range = () => chain
      chain.single = () => {
        if ((chain as Row).mode === 'insert') return { data: { id: `new-${table}` }, error: null }
        return resultFor()
      }
      chain.insert = (row: Row) => {
        inserts.push({ table, row })
        ;(chain as Row).mode = 'insert'
        return chain
      }
      chain.update = (row: Row) => {
        updates.push({ table, row })
        ;(chain as Row).mode = 'update'
        return chain
      }
      chain.then = (resolve: (v: unknown) => unknown) => {
        if ((chain as Row).mode === 'insert') return resolve({ data: { id: `new-${table}` }, error: null })
        if ((chain as Row).mode === 'update') return resolve({ data: null, error: null })
        return resolve(resultFor())
      }
      return chain
    },
  }

  return { client, inserts, updates }
}

function pendingEvent(overrides: Row = {}): Row {
  return {
    id: 'aaaaaaaa-1111-1111-1111-111111111111',
    business_id: BUSINESS_ID,
    assistant_id: '2f57cd29-fef3-4167-8745-4f02b57d4850',
    correction_type: 'mistake_prevention',
    category: null,
    severity: 'critical',
    original_response: null,
    corrected_response: null,
    knowledge_change: { learning: 'No inventes testimonios de otros clientes' },
    status: 'pending',
    ...overrides,
  }
}

function request(action: 'approve' | 'reject') {
  return new Request('http://localhost/api/laboratorio/teach/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'aaaaaaaa-1111-1111-1111-111111111111', action }),
  })
}

async function setup(event: Row, opts?: { businessOwned?: boolean; messages?: Row[] }) {
  const { client, inserts, updates } = makeAdmin(event, opts)
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: USER_ID } } }) },
  } as unknown as Awaited<ReturnType<typeof createClient>>)
  vi.mocked(createAdminClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminClient>)
  return { inserts, updates }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/laboratorio/teach/approve', () => {
  it('materializa mistake_prevention como ai_instruction usando knowledge_change.learning', async () => {
    // Regresión: este tipo devolvía 400 porque exigía corrected_response.
    const { inserts, updates } = await setup(pendingEvent())

    const res = await POST(request('approve'))

    expect(res.status).toBe(200)
    const instruction = inserts.find((i) => i.table === 'ai_instructions')
    expect(instruction).toBeDefined()
    expect(instruction?.row.instruction).toBe('No inventes testimonios de otros clientes')
    expect(instruction?.row.source).toBe('correction')
    expect(updates[0]?.row.status).toBe('approved')
    expect(invalidatorMock.invalidateSystemContext).toHaveBeenCalledWith(BUSINESS_ID)
  })

  it('materializa product como sales_rule con categoria product', async () => {
    const { inserts, updates } = await setup(
      pendingEvent({
        correction_type: 'product',
        knowledge_change: { learning: 'Un solo precio por producto' },
      })
    )

    const res = await POST(request('approve'))

    expect(res.status).toBe(200)
    const rule = inserts.find((i) => i.table === 'sales_rules')
    expect(rule).toBeDefined()
    expect(rule?.row.category).toBe('product')
    expect(rule?.row.content).toBe('Un solo precio por producto')
    expect(inserts.some((i) => i.table === 'ai_instructions')).toBe(false)
    expect(updates[0]?.row.status).toBe('approved')
  })

  it('respeta la categoria explicita del evento', async () => {
    const { inserts } = await setup(
      pendingEvent({ correction_type: 'rule', category: 'payment', corrected_response: 'Solo contra entrega' })
    )

    await POST(request('approve'))

    expect(inserts.find((i) => i.table === 'sales_rules')?.row.category).toBe('payment')
  })

  it('sigue soportando knowledge con question/answer', async () => {
    const { inserts } = await setup(
      pendingEvent({
        correction_type: 'knowledge',
        original_response: '¿Cuánto cuesta Clean Nails?',
        corrected_response: 'Cuesta $550',
      })
    )

    const res = await POST(request('approve'))

    expect(res.status).toBe(200)
    const item = inserts.find((i) => i.table === 'knowledge_items')
    expect(item?.row.question).toBe('¿Cuánto cuesta Clean Nails?')
    expect(item?.row.answer).toBe('Cuesta $550')
  })

  it('rechaza sin materializar nada', async () => {
    const { inserts, updates } = await setup(pendingEvent())

    const res = await POST(request('reject'))

    expect(res.status).toBe(200)
    expect(inserts).toHaveLength(0)
    expect(updates[0]?.row.status).toBe('rejected')
    expect(invalidatorMock.invalidateSystemContext).not.toHaveBeenCalled()
  })

  it('devuelve 400 si no hay contenido aprobable', async () => {
    await setup(pendingEvent({ knowledge_change: null, corrected_response: null }))

    const res = await POST(request('approve'))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('No content to approve')
  })

  it('rechaza correction_type fuera del catalogo', async () => {
    await setup(pendingEvent({ correction_type: 'inventado' }))

    const res = await POST(request('approve'))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Unsupported correction type')
  })

  it('no aprueba si el negocio no pertenece al usuario', async () => {
    await setup(pendingEvent(), { businessOwned: false })

    const res = await POST(request('approve'))

    expect(res.status).toBe(403)
  })

  describe('guard de transcripción', () => {
    /** 44 caracteres: supera el mínimo largo, así que la que lo rechaza es la del corpus. */
    const FRAGMENTO = 'una disculpa nuestro bot anda emocionado hoy'

    it('rechaza con 422 una instrucción que es texto de una conversación', async () => {
      const { inserts } = await setup(
        pendingEvent({ correction_type: 'instruction', knowledge_change: { learning: FRAGMENTO } }),
        {
          messages: [
            { content: 'una disculpa nuestro bot anda emocionado hoy', received_at: '2026-06-02T10:00:00Z' },
          ],
        },
      )

      const res = await POST(request('approve'))

      expect(res.status).toBe(422)
      expect((await res.json()).error).toMatch(/literalmente en una conversación/)
      expect(inserts.filter((i) => i.table === 'ai_instructions')).toHaveLength(0)
    })

    it('rechaza con 422 un texto demasiado corto', async () => {
      const { inserts } = await setup(
        pendingEvent({ correction_type: 'instruction', knowledge_change: { learning: 'ok' } }),
      )

      const res = await POST(request('approve'))

      expect(res.status).toBe(422)
      expect((await res.json()).error).toMatch(/Demasiado corto/)
      expect(inserts.filter((i) => i.table === 'ai_instructions')).toHaveLength(0)
    })

    it('aprueba una instrucción sintetizada aunque el corpus esté lleno', async () => {
      const { inserts } = await setup(pendingEvent({ correction_type: 'instruction' }), {
        messages: [
          { content: 'le llegaria hoy a partir de las 2 pm', received_at: '2026-07-25T10:00:00Z' },
          { content: 'no hay costo en el envio', received_at: '2026-06-02T10:00:00Z' },
        ],
      })

      const res = await POST(request('approve'))

      expect(res.status).toBe(200)
      expect(inserts.filter((i) => i.table === 'ai_instructions')).toHaveLength(1)
    })

    it('no consulta el corpus cuando el texto ya es demasiado corto', async () => {
      await setup(
        pendingEvent({ correction_type: 'instruction', knowledge_change: { learning: 'ok' } }),
      )

      const res = await POST(request('approve'))

      expect(res.status).toBe(422)
    })
  })
})