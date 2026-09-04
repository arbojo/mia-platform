import { describe, it, expect, vi, beforeEach } from 'vitest'

// F4 — GODZILLA / STRESS TEST (gate stress_test) — TASK-20260209-ASYNCLEARN001
// Ataca la robustez de la ingesta asíncrona: worker muerto a mitad, doble
// ejecución (lease race), OpenAI 429/lento, archivo corrupto, estado zombi.

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/ai/extract', () => ({ extractKnowledgeFromText: vi.fn() }))
vi.mock('@/lib/ai/knowledge', () => ({ getBusinessExtractionContext: vi.fn() }))
vi.mock('@/lib/knowledge/file-extract', () => ({ extractTextFromFile: vi.fn() }))

import { POST as processPost } from '@/app/api/knowledge/learn/process/route'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractKnowledgeFromText } from '@/lib/ai/extract'
import { getBusinessExtractionContext } from '@/lib/ai/knowledge'
import { extractTextFromFile } from '@/lib/knowledge/file-extract'

const REPORT = 'd1111111-1111-1111-1111-111111111111'
const BIZ = 'b1111111-1111-1111-1111-111111111111'

const files = [
  { name: 'a.txt', size: 4, type: 'text/plain', storage_path: 'learning/r/0-a.txt' },
  { name: 'b.txt', size: 4, type: 'text/plain', storage_path: 'learning/r/1-b.txt' },
]

function mockSupabase(overrides: {
  leased?: unknown
  pending?: unknown
  downloadError?: boolean
  reportRow?: unknown
} = {}) {
  const method = () => vi.fn((..._a: unknown[]) => chain)
  let lastSelect = ''
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn((cols: unknown) => {
      lastSelect = typeof cols === 'string' ? cols : ''
      return chain
    }),
    eq: vi.fn(() => chain),
    or: vi.fn(() => chain),
    order: method(),
    not: method(),
    update: method(),
    insert: method(),
    maybeSingle: method(),
    single: vi.fn(() => {
      if (lastSelect.includes('files_total')) {
        return Promise.resolve({ data: overrides.leased ?? null, error: null })
      }
      // token-mode read (status + processing_token); valid by default
      return Promise.resolve({
        data: overrides.reportRow === null
          ? null
          : { id: REPORT, status: 'processing', processing_token: 't', ...(overrides.reportRow ?? {}) },
        error: null,
      })
    }),
    limit: vi.fn(() =>
      Promise.resolve({ data: overrides.pending ?? [], error: null })
    ),
  }
  const supabase = {
    from: vi.fn(() => chain),
    storage: {
      from: vi.fn(() => ({
        download: vi.fn(() =>
          Promise.resolve(
            overrides.downloadError
              ? { data: null, error: { message: 'storage down' } }
              : { data: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) }, error: null }
          )
        ),
      })),
    },
  }
  vi.mocked(createAdminClient).mockReturnValue(supabase as never)
  return { supabase, chain }
}

function leasedReport(partial: Record<string, unknown> = {}) {
  return {
    id: REPORT,
    business_id: BIZ,
    files_total: 2,
    files_done: 0,
    files_processed: files,
    ...partial,
  }
}

function workerRequest(body?: unknown) {
  return new Request('http://localhost/api/knowledge/learn/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getBusinessExtractionContext).mockResolvedValue({
    existingProducts: [],
    existingKnowledge: [],
    existingRules: [],
  } as never)
  vi.mocked(extractKnowledgeFromText).mockResolvedValue({
    products: [],
    knowledge: [],
    rules: [],
    missingFields: [],
    summary: { productsFound: 0, pricesFound: 0, benefitsFound: 0, faqsFound: 0, promotionsFound: 0, knowledgeFound: 0, rulesFound: 0 },
  } as never)
  vi.mocked(extractTextFromFile).mockResolvedValue('texto')
})

describe('GODZILLA — Worker lease race (doble ejecución)', () => {
  it('lease tomado (otro worker) → leased:false, sin extracción LLM', async () => {
    mockSupabase({ leased: null, pending: [] })
    const res = await processPost(workerRequest({ report_id: REPORT, token: 't' }))
    const data = await res.json()
    expect(data.leased).toBe(false)
    expect(extractKnowledgeFromText).not.toHaveBeenCalled()
  })
})

describe('GODZILLA — Worker muerto a mitad (reporte zombi, lease expirado)', () => {
  it('reanuda desde files_done sin re-procesar archivos ya hechos', async () => {
    mockSupabase({
      leased: leasedReport({ files_done: 1 }),
      pending: [{ id: REPORT }],
    })
    await processPost(workerRequest({ report_id: REPORT, token: 't' }))
    const textCalls = vi.mocked(extractTextFromFile).mock.calls
    expect(textCalls.length).toBe(1)
  })
})

describe('GODZILLA — Storage caído (archivo corrupto)', () => {
  it('un archivo falla, el reporte NO queda en processing (terminal garantizado)', async () => {
    const { chain } = mockSupabase({
      leased: leasedReport(),
      pending: [],
      downloadError: true,
    })
    const res = await processPost(workerRequest({ report_id: REPORT, token: 't' }))
    const data = await res.json()
    expect(data.status).toBe('failed')
    const failedUpdate = chain.update.mock.calls.find((c) =>
      c[0] && typeof c[0] === 'object' && (c[0] as Record<string, unknown>).status === 'failed'
    )
    expect(failedUpdate).toBeTruthy()
  })
})

describe('GODZILLA — OpenAI 429 / timeout extremo', () => {
  it('fallo LLM en un archivo NO tumba los demás (procesa el siguiente)', async () => {
    mockSupabase({ leased: leasedReport(), pending: [] })
    vi.mocked(extractKnowledgeFromText)
      .mockRejectedValueOnce(new Error('429 rate limit'))
      .mockResolvedValueOnce({
        products: [],
        knowledge: [],
        rules: [],
        missingFields: [],
        summary: { productsFound: 0, pricesFound: 0, benefitsFound: 0, faqsFound: 0, promotionsFound: 0, knowledgeFound: 0, rulesFound: 0 },
      } as never)
    const res = await processPost(workerRequest({ report_id: REPORT, token: 't' }))
    const data = await res.json()
    expect(data.status).toBe('completed')
    expect(vi.mocked(extractKnowledgeFromText).mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})

describe('GODZILLA — Token inválido / reporte inexistente', () => {
  it('reporte inexistente (token-read devuelve null) → 403 sin side effects', async () => {
    mockSupabase({ leased: undefined, pending: [], reportRow: null })
    const res = await processPost(workerRequest({ report_id: 'no-existe', token: 't' }))
    expect(res.status).toBe(403)
    expect(extractKnowledgeFromText).not.toHaveBeenCalled()
  })
})