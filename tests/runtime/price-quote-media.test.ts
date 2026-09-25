import { describe, it, expect, beforeEach } from 'vitest'
import { resolveContextMedia } from '@/lib/runtime/context-media'
import { resolveScopeContext } from '@/lib/runtime/context-scope'

/**
 * Regla de cotización — "precio ⇒ presentación de producto".
 * ────────────────────────────────────────────────────────────────
 * ADR-031 extendida (solo intent `price`): cuando el scope es ÚNICO y la
 * intención del turno es `price` (cotización), la representativa propia del
 * producto es elegible una sola vez por conversación aunque el scope venga
 * heredado (context), SIEMPRE que no haya señal conservadora de producto
 * distinto. Así la imagen acompaña al precio+descripción sin depender de que
 * el cliente escriba bien el nombre ("eñas", "el de las eñas", etc.).
 *
 * Contratos vigentes que esta regla NO rompe:
 *   - cadencia ADR-031: re-pregunta de precio → existing_hit (solo texto).
 *   - resend explícito R8 sigue habilitando reenvío.
 *   - guard conservador (b) → MEDIA_SCOPE_UNCERTAIN, sin dispatch.
 *   - solo `price`; shipping/payment NO adjuntan media desde contexto.
 */

const SAFE_URL =
  'https://abc123.supabase.co/storage/v1/object/public/knowledge-media/biz-1/img.jpg'

type KnowledgeRow = {
  id: string
  business_id: string
  product_id: string | null
  image_url: string | null
  answer: string | null
  trigger_condition: string | null
  media_type: 'image' | 'testimonial'
  is_active: boolean
  position: number | null
  created_at: string
}

type ClaimRow = {
  knowledge_item_id: string
  conversation_id: string
  state: string
  created_at?: string
}

function kitem(overrides: Partial<KnowledgeRow>): KnowledgeRow {
  return {
    id: 'item-' + Math.random().toString(36).slice(2, 8),
    business_id: 'biz-1',
    product_id: 'p-clean',
    image_url: SAFE_URL,
    answer: 'Imagen del dispositivo Clean Nails',
    trigger_condition: 'uñas, uña, clean nails, aparato, precio cuesta',
    media_type: 'image',
    is_active: true,
    position: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

/**
 * Harness que modela la semántica REAL de Supabase para las tablas que usan
 * resolveScopeContext + resolveContextMedia (misma semántica que
 * context-media-golden.test.ts).
 */
function makeHarness(opts: {
  products?: Array<{ id: string; name: string; sku: string | null; is_active?: boolean }>
  knowledge?: KnowledgeRow[]
  claims?: ClaimRow[]
  conversations?: Record<string, { active_product_ids?: string[] }>
} = {}) {
  const claims = new Map<string, ClaimRow>()
  for (const c of opts.claims ?? []) {
    claims.set(`${c.knowledge_item_id}::${c.conversation_id}`, c)
  }
  const convs = new Map<string, { active_product_ids?: string[] }>(
    Object.entries(opts.conversations ?? {})
  )
  const activeKnowledge = (opts.knowledge ?? []).filter((k) => k.is_active && k.image_url != null)
  const activeProducts = (opts.products ?? []).filter((p) => p.is_active !== false)

  const supabase = {
    from: (table: string) => {
      const conversationId = opts.conversations ? Object.keys(opts.conversations)[0] ?? 'conv-x' : 'conv-x'
      if (table === 'products') {
        const q: Record<string, unknown> = {}
        q.select = () => q
        q.eq = () => q
        q.maybeSingle = () => {
          return Promise.resolve({ data: activeProducts[0] ?? null, error: null })
        }
        q.then = (fn: (v: unknown) => unknown) =>
          Promise.resolve({ data: activeProducts, error: null }).then(fn)
        return q
      }
      if (table === 'knowledge_items') {
        const data = activeKnowledge
        const q: Record<string, unknown> = {}
        q.select = () => q
        q.eq = () => q
        q.not = () => q
        q.order = () => q
        q.then = (fn: (v: unknown) => unknown) =>
          Promise.resolve({ data, error: null }).then(fn)
        return q
      }
      if (table === 'chat_media_dispatched') {
        const q: Record<string, unknown> = {}
        q.select = () => q
        q.eq = () => q
        q.then = (fn: (v: unknown) => unknown) =>
          Promise.resolve({ data: [...claims.values()], error: null }).then(fn)
        q.update = (payload: Record<string, unknown>) => {
          for (const [key, row] of claims) {
            if (row.conversation_id === conversationId) {
              claims.set(key, { ...row, ...payload })
            }
          }
          return q
        }
        q.upsert = (payload: Record<string, unknown>) => {
          const key = `${payload.knowledge_item_id}::${payload.conversation_id}`
          if (claims.has(key)) {
            return { select: () => Promise.resolve({ data: [], error: null }) }
          }
          claims.set(key, payload as unknown as ClaimRow)
          return {
            select: () =>
              Promise.resolve({
                data: [{ knowledge_item_id: payload.knowledge_item_id }],
                error: null,
              }),
          }
        }
        return q
      }
      if (table === 'conversations') {
        const q: Record<string, unknown> = {}
        q.select = () => q
        q.eq = () => q
        q.maybeSingle = () => {
          return Promise.resolve({
            data: convs.get(conversationId) ?? { active_product_ids: [] },
            error: null,
          })
        }
        q.update = (payload: Record<string, unknown>) => {
          const prev = convs.get(conversationId) ?? {}
          convs.set(conversationId, { ...prev, ...payload })
          return q
        }
        return q
      }
      return {
        then: (fn: (v: unknown) => unknown) =>
          Promise.resolve({ data: null, error: null }).then(fn),
      }
    },
  }

  return { supabase, claims, convs }
}

const CLEAN_PRODUCT = { id: 'p-clean', name: 'Clean Nails', sku: 'CN-001' }

let conversationId = 'conv-x'

beforeEach(() => {
  conversationId = 'conv-' + Math.random().toString(36).slice(2, 8)
})

function mediaStatusOf(d: { mediaStatus?: string }): string | undefined {
  return d.mediaStatus
}

describe('Precio (price) + contexto único → cotización con imagen (una vez)', () => {
  it('turno con typo "el de las eñas": scope context + intent price → representativa dispatchada', async () => {
    const h = makeHarness({
      products: [CLEAN_PRODUCT],
      knowledge: [kitem({ id: 'k-img' })],
      conversations: { [conversationId]: { active_product_ids: ['p-clean'] } },
    })

    const scope = await resolveScopeContext({
      supabase: h.supabase as never,
      businessId: 'biz-1',
      conversationId,
      userMessage: 'precio del de las eñas +',
    })
    expect(scope.source).toBe('context')
    expect(scope.messageScope).toEqual(['p-clean'])

    const res = await resolveContextMedia({
      businessId: 'biz-1',
      conversationId,
      userMessage: 'precio del de las eñas +',
      intentTag: 'price',
      scope: scope.messageScope,
      scopeSource: scope.source,
      supabase: h.supabase as never,
    })
    expect(res.attachment?.knowledgeItemId).toBe('k-img')
    expect(res.decision.claim).toBe('created')
    expect(mediaStatusOf(res.decision as { mediaStatus?: string })).toBe('DISPATCHED')
  })

  it('re-pregunta de precio en la misma conversación → existing_hit, sin re-envío (solo texto)', async () => {
    const h = makeHarness({
      products: [CLEAN_PRODUCT],
      knowledge: [kitem({ id: 'k-img' })],
      claims: [
        { knowledge_item_id: 'k-img', conversation_id: conversationId, state: 'dispatched' },
      ],
      conversations: { [conversationId]: { active_product_ids: ['p-clean'] } },
    })

    const res = await resolveContextMedia({
      businessId: 'biz-1',
      conversationId,
      userMessage: 'y el precio?',
      intentTag: 'price',
      scope: ['p-clean'],
      scopeSource: 'context',
      supabase: h.supabase as never,
    })
    expect(res.attachment).toBeNull()
    expect(res.decision.claim).toBe('existing_hit')
    expect(mediaStatusOf(res.decision as { mediaStatus?: string })).toBe('NONE')
  })

  it('intenciones NO-price (shipping/payment) no adjuntan media desde contexto', async () => {
    const h = makeHarness({
      products: [CLEAN_PRODUCT],
      knowledge: [kitem({ id: 'k-img' })],
      conversations: { [conversationId]: { active_product_ids: ['p-clean'] } },
    })

    for (const tag of ['shipping', 'payment']) {
      const res = await resolveContextMedia({
        businessId: 'biz-1',
        conversationId,
        userMessage: 'zona de envío',
        intentTag: tag,
        scope: ['p-clean'],
        scopeSource: 'context',
        supabase: h.supabase as never,
      })
      expect(res.attachment, `tag=${tag}`).toBeNull()
      expect(mediaStatusOf(res.decision as { mediaStatus?: string }), `tag=${tag}`).toBe(
        'MEDIA_REQUEST_NOT_RECOGNIZED'
      )
    }
  })

  it('price + señal conservadora de producto distinto → MEDIA_SCOPE_UNCERTAIN (sin dispatch)', async () => {
    const h = makeHarness({
      products: [CLEAN_PRODUCT],
      knowledge: [kitem({ id: 'k-img' })],
    })

    const res = await resolveContextMedia({
      businessId: 'biz-1',
      conversationId,
      userMessage: 'precio del de las eñas +',
      intentTag: 'price',
      scope: ['p-clean'],
      scopeSource: 'context',
      uncertainDifferentProduct: true,
      supabase: h.supabase as never,
    })
    expect(res.attachment).toBeNull()
    expect(mediaStatusOf(res.decision as { mediaStatus?: string })).toBe('MEDIA_SCOPE_UNCERTAIN')
  })

  it('scope explícito + price sigue intacto (ADR-031 original)', async () => {
    const h = makeHarness({
      products: [CLEAN_PRODUCT],
      knowledge: [kitem({ id: 'k-img' })],
      conversations: { [conversationId]: { active_product_ids: ['p-clean'] } },
    })

    const res = await resolveContextMedia({
      businessId: 'biz-1',
      conversationId,
      userMessage: 'cuánto cuesta',
      intentTag: 'price',
      scope: ['p-clean'],
      scopeSource: 'explicit',
      explicitSource: 'literal',
      supabase: h.supabase as never,
    })
    expect(res.attachment?.knowledgeItemId).toBe('k-img')
  })

  it('mediaIntent "tienes imagen?" con asset ya despachado → redispatch existing_hit (sin regresión del caso real)', async () => {
    const h = makeHarness({
      products: [CLEAN_PRODUCT],
      knowledge: [kitem({ id: 'k-img' })],
      claims: [
        { knowledge_item_id: 'k-img', conversation_id: conversationId, state: 'dispatched' },
      ],
      conversations: { [conversationId]: { active_product_ids: ['p-clean'] } },
    })

    const res = await resolveContextMedia({
      businessId: 'biz-1',
      conversationId,
      userMessage: 'tienes imagen?',
      scope: ['p-clean'],
      scopeSource: 'context',
      supabase: h.supabase as never,
    })
    expect(res.attachment?.knowledgeItemId).toBe('k-img')
    expect(res.decision.claim).toBe('existing_hit')
    expect(mediaStatusOf(res.decision as { mediaStatus?: string })).toBe('DISPATCHED')
  })
})