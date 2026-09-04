import { describe, it, expect } from 'vitest'
import {
  resolveScopeContext,
  resolveActiveProductIdentity,
  type ScopeResolution,
} from '@/lib/runtime/context-scope'
import { withProductScopeAnchor } from '@/lib/ai/prompts'

/**
 * B3 — Contract tests (doc 30 LLM-PRODUCT-SCOPE, TASK-20260904-210844465).
 *
 * El scope determinístico del runtime (un único producto activo) debe llegar
 * al contexto de generación como anchor de IDENTIDAD: nombre canónico del
 * catálogo + product_id. Sin precio, beneficios, claims ni heurísticas.
 */

type CatalogProduct = { id: string; name: string; sku: string | null; is_active?: boolean }

const CATALOG: CatalogProduct[] = [
  { id: 'p-neuro', name: 'Neurotin', sku: 'NT-100', is_active: true },
  { id: 'p-back', name: 'Back2Fit', sku: 'B2F-200', is_active: true },
]

const BASE_PROMPT = 'Eres un asistente de ventas de Vitanova.'

function makeHarness(options: {
  products?: CatalogProduct[]
  conversations?: Record<string, string[]>
}) {
  const products = options.products ?? CATALOG
  const convs = new Map<string, string[]>(Object.entries(options.conversations ?? {}))
  const conversationId = 'conv-b3'

  const supabase = {
    from: (table: string) => {
      if (table === 'products') {
        const q: Record<string, unknown> = {}
        q.select = () => q
        q.eq = () => q
        q.maybeSingle = () =>
          Promise.resolve({ data: (products[0] as CatalogProduct) ?? null, error: null })
        q.then = (fn: (v: unknown) => unknown) =>
          Promise.resolve({ data: products, error: null }).then(fn)
        return q
      }
      if (table === 'conversations') {
        const q: Record<string, unknown> = {}
        q.select = () => q
        q.eq = () => q
        q.maybeSingle = () =>
          Promise.resolve({
            data: { active_product_ids: convs.get(conversationId) ?? [] },
            error: null,
          })
        q.update = (payload: Record<string, unknown>) => {
          convs.set(conversationId, (payload.active_product_ids as string[]) ?? [])
          return q
        }
        return q
      }
      const q: Record<string, unknown> = {}
      q.then = (fn: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(fn)
      return q
    },
  }

  return {
    resolve: (message: string, landingProductId?: string | null) =>
      resolveScopeContext({
        supabase: supabase as never,
        businessId: 'biz-b3',
        conversationId,
        userMessage: message,
        landingProductId,
      }),
  }
}

function identity(scope: ScopeResolution) {
  return resolveActiveProductIdentity(scope)
}

describe('B3 — product scope anchor', () => {
  it('contrato 1: scope explicit único → anchor con nombre canónico + product_id', async () => {
    const h = makeHarness({ conversations: {} })
    const scope = await h.resolve('quiero información del Neurotin')

    expect(scope.source).toBe('explicit')
    expect(scope.messageScope).toEqual(['p-neuro'])

    const anchor = identity(scope)
    expect(anchor).toEqual({ productId: 'p-neuro', name: 'Neurotin' })
    // Provenance: el nombre del anchor ES el del catálogo canónico (names[id]).
    expect(scope.names[anchor?.productId ?? '']).toBe('Neurotin')

    const prompt = withProductScopeAnchor(BASE_PROMPT, anchor)
    expect(prompt).toContain('## Producto activo en esta conversación')
    expect(prompt).toContain('**Neurotin**')
    expect(prompt).toContain('product_id: p-neuro')
  })

  it('contrato 2: scope Back2Fit → anchor Back2Fit + product_id (no confunde el catálogo)', async () => {
    const h = makeHarness({ conversations: { 'conv-b3': [] } })
    const scope = await h.resolve('cuánto cuesta el Back2Fit')

    expect(scope.source).toBe('explicit')
    const anchor = identity(scope)
    expect(anchor).toEqual({ productId: 'p-back', name: 'Back2Fit' })
    expect(scope.names[anchor?.productId ?? '']).toBe('Back2Fit')

    const prompt = withProductScopeAnchor(BASE_PROMPT, anchor)
    expect(prompt).toContain('**Back2Fit**')
    expect(prompt).toContain('product_id: p-back')
    expect(prompt).not.toContain('Neurotin')
  })

  it('contrato 3: sin scope (none) → sin anchor y prompt sin modificar', async () => {
    const h = makeHarness({ conversations: { 'conv-b3': [] } })
    const scope = await h.resolve('hola, buen día')

    expect(scope.source).toBe('none')
    expect(identity(scope)).toBeNull()
    expect(withProductScopeAnchor(BASE_PROMPT, null)).toBe(BASE_PROMPT)
  })

  it('contrato 4: scope ambiguous (2+ productos, sin explicit) → sin anchor, sin selección arbitraria', async () => {
    const h = makeHarness({ conversations: { 'conv-b3': ['p-neuro', 'p-back'] } })
    const scope = await h.resolve('me gustaría saber más')

    expect(scope.source).toBe('ambiguous')
    expect(scope.messageScope).toEqual([])
    expect(identity(scope)).toBeNull()
  })

  it('contrato 5: cambio de producto entre turnos → el anchor SIEMPRE es el scope actual (sin contaminar el cache/prompt anterior)', async () => {
    const h = makeHarness({ conversations: {} })

    const turn1 = await h.resolve('quiero información del Neurotin')
    const anchor1 = identity(turn1)
    expect(anchor1).toEqual({ productId: 'p-neuro', name: 'Neurotin' })
    const prompt1 = withProductScopeAnchor(BASE_PROMPT, anchor1)
    expect(prompt1).toContain('**Neurotin**')
    expect(prompt1).not.toContain('Back2Fit')

    // El contexto histórico persiste, pero el scope del turno 2 es Back2Fit.
    const turn2 = await h.resolve('ahora quiero saber del Back2Fit')
    expect(turn2.activeProductIds).toEqual(['p-back', 'p-neuro'])
    const anchor2 = identity(turn2)
    expect(anchor2).toEqual({ productId: 'p-back', name: 'Back2Fit' })

    const prompt2 = withProductScopeAnchor(BASE_PROMPT, anchor2)
    expect(prompt2).toContain('**Back2Fit**')
    expect(prompt2).toContain('product_id: p-back')
    // El nombre del producto anterior NO sobrevive en el contexto generativo.
    expect(prompt2).not.toContain('Neurotin')
  })

  it('contexto persistido determinístico (source context) → mismo tratamiento que explicit', async () => {
    const h = makeHarness({ conversations: { 'conv-b3': ['p-neuro'] } })
    const scope = await h.resolve('hola de nuevo')

    expect(scope.source).toBe('context')
    expect(scope.messageScope).toEqual(['p-neuro'])
    expect(identity(scope)).toEqual({ productId: 'p-neuro', name: 'Neurotin' })
  })

  it('multi-explicit en el MISMO mensaje → null (no es único, sin selección arbitraria)', async () => {
    const h = makeHarness({ conversations: {} })
    const scope = await h.resolve('compara el Neurotin con el Back2Fit')

    expect(scope.source).toBe('explicit')
    expect(scope.messageScope).toEqual(['p-neuro', 'p-back'])
    expect(identity(scope)).toBeNull()
  })

  it('scope landing exclusivo → null (la landing ya ancla con su propia nota de contexto)', async () => {
    const h = makeHarness({ conversations: {} })
    const scope = await h.resolve('hola', 'p-neuro')

    expect(scope.source).toBe('landing')
    expect(scope.messageScope).toEqual(['p-neuro'])
    expect(identity(scope)).toBeNull()
  })

  it('producto activo sin nombre canónico en el catálogo → null (sin inventar nombre)', async () => {
    const h = makeHarness({
      products: [{ id: 'p-ghost', name: '', sku: 'GH-1', is_active: true }],
      conversations: { 'conv-b3': ['p-ghost'] },
    })
    const scope = await h.resolve('cuéntame de eso')
    expect(scope.source).toBe('context')
    expect(scope.names['p-ghost']).toBeUndefined()
    expect(identity(scope)).toBeNull()
  })
})