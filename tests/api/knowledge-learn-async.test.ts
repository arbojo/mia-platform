import { describe, it, expect, vi, beforeEach } from 'vitest'

// F4 — TASK-20260209-ASYNCLEARN001: ingesta asíncrona de conocimiento.

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/ai/extract', () => ({ extractKnowledgeFromText: vi.fn() }))
vi.mock('@/lib/ai/knowledge', () => ({ getBusinessExtractionContext: vi.fn() }))
vi.mock('@/lib/knowledge/file-extract', () => ({ extractTextFromFile: vi.fn() }))
vi.mock('@/lib/cache/invalidator', () => ({ invalidateSystemContext: vi.fn() }))

import { POST as learnPost } from '@/app/api/knowledge/learn/route'
import { POST as processPost } from '@/app/api/knowledge/learn/process/route'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractKnowledgeFromText } from '@/lib/ai/extract'
import { getBusinessExtractionContext } from '@/lib/ai/knowledge'
import { extractTextFromFile } from '@/lib/knowledge/file-extract'

const FAKE_UUIDS = {
  business: 'b1111111-1111-1111-1111-111111111111',
  report: 'd1111111-1111-1111-1111-111111111111',
  user: 'e1111111-1111-1111-1111-111111111111',
}

function makeAdminMock(overrides: {
  leased?: unknown
  reportRow?: unknown
  insertError?: boolean
  pending?: unknown
} = {}) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {}
  let lastSelect = ''

  const method = (terminal?: () => unknown) =>
    vi.fn((..._args: unknown[]) => (terminal ? terminal() : chain))

  chain.select = vi.fn((cols: unknown) => {
    lastSelect = typeof cols === 'string' ? cols : ''
    return chain
  })
  chain.eq = method(() => chain)
  chain.or = method(() => chain)
  chain.order = method(() => chain)
  chain.not = method(() => chain)
  chain.update = method(() => chain)
  chain.limit = vi.fn(() =>
    Promise.resolve({ data: overrides.pending ?? [], error: null })
  )
  chain.update = method(() => chain)
  chain.maybeSingle = method(() => Promise.resolve({ data: null, error: null }))
  chain.single = vi.fn(() => {
    if (lastSelect.includes('files_total')) {
      return Promise.resolve({ data: overrides.leased ?? null, error: null })
    }
    return Promise.resolve({ data: overrides.reportRow ?? { id: FAKE_UUIDS.report }, error: overrides.insertError ? { message: 'insert failed' } : null })
  })
  chain.insert = method(() => chain)
  chain.download = method(() =>
    Promise.resolve({ data: { arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) }, error: null })
  )

  const supabase = {
    from: vi.fn(() => chain),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({ error: null })),
        download: chain.download,
      })),
    },
  }
  vi.mocked(createAdminClient).mockReturnValue(supabase as never)
  return { supabase, chain }
}

function makeServerMock(userId: string | null) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn(() =>
      Promise.resolve({ data: userId ? { id: FAKE_UUIDS.business } : null, error: null })
    ),
  }
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: userId ? { id: userId } : null }, error: null }) },
    from: vi.fn(() => chain),
  } as never)
  return chain
}

function learnRequest(fileCount = 2) {
  const fd = new FormData()
  fd.append('business_id', FAKE_UUIDS.business)
  for (let i = 0; i < fileCount; i++) {
    fd.append('files', new File(['contenido'], `doc-${i}.txt`, { type: 'text/plain' }))
  }
  return new Request('http://localhost/api/knowledge/learn', { method: 'POST', body: fd })
}

beforeEach(() => {
  vi.clearAllMocks()
  makeServerMock(FAKE_UUIDS.user)
  vi.mocked(getBusinessExtractionContext).mockResolvedValue({
    existingProducts: [],
    existingKnowledge: [],
    existingRules: [],
  } as never)
  vi.mocked(extractKnowledgeFromText).mockResolvedValue({
    products: [{ name: 'Prod', price: 10, description: null, benefits: null, faq: [], restrictions: null, confidence: 90 }],
    knowledge: [],
    rules: [],
    missingFields: [],
    summary: { productsFound: 1, pricesFound: 1, benefitsFound: 0, faqsFound: 0, promotionsFound: 0, knowledgeFound: 0, rulesFound: 0 },
  } as never)
  vi.mocked(extractTextFromFile).mockResolvedValue('texto de prueba')
})

describe('RECEPTION (F1) — /api/knowledge/learn responde inmediatamente', () => {
  it('crea el report y devuelve report_id sin procesar archivos (sin OpenAI)', async () => {
    const { supabase } = makeAdminMock()
    const res = await learnPost(learnRequest(2))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.report_id).toBe(FAKE_UUIDS.report)
    expect(data.status).toBe('processing')
    expect(data.files_total).toBe(2)

    // Los archivos se persisten en Storage (uno por archivo)
    expect(supabase.storage.from).toHaveBeenCalledWith('knowledge-media')
    // El reporte se crea en processing con files_total
    const insertPayload = vi.mocked(supabase.from).mock.calls.find(([t]) => t === 'learning_reports')
    expect(insertPayload).toBeDefined()
  })

  it('rechaza archivos fuera de límites (más de 10)', async () => {
    makeAdminMock()
    const res = await learnPost(learnRequest(11))
    expect(res.status).toBe(400)
  })
})

describe('WORKER (F2) — /api/knowledge/learn/process', () => {
  it('token inválido → 403', async () => {
    makeAdminMock({ reportRow: { id: FAKE_UUIDS.report, status: 'processing', processing_token: 'otro-token' } })

    const res = await processPost(
      new Request('http://localhost/api/knowledge/learn/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: FAKE_UUIDS.report, token: 'token-malo' }),
      })
    )
    expect(res.status).toBe(403)
  })

  it('lease tomado por otro worker → leased:false (sin doble ejecución)', async () => {
    makeAdminMock({
      reportRow: { id: FAKE_UUIDS.report, status: 'processing', processing_token: 'token-ok' },
      leased: null,
    })

    const res = await processPost(
      new Request('http://localhost/api/knowledge/learn/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: FAKE_UUIDS.report, token: 'token-ok' }),
      })
    )
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.leased).toBe(false)
    expect(extractKnowledgeFromText).not.toHaveBeenCalled()
  })

  it('happy path: procesa por archivo, progreso incremental y terminal completed', async () => {
    const reportRow = {
      id: FAKE_UUIDS.report,
      business_id: FAKE_UUIDS.business,
      files_total: 2,
      files_done: 0,
      files_processed: [
        { name: 'a.txt', size: 4, type: 'text/plain', storage_path: 'learning/r/0-a.txt' },
        { name: 'b.txt', size: 4, type: 'text/plain', storage_path: 'learning/r/1-b.txt' },
      ],
    }
    makeAdminMock({
      reportRow: { id: FAKE_UUIDS.report, status: 'processing', processing_token: 'token-ok' },
      leased: reportRow,
    })

    const res = await processPost(
      new Request('http://localhost/api/knowledge/learn/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: FAKE_UUIDS.report, token: 'token-ok' }),
      })
    )
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.status).toBe('completed')
    expect(data.files_done).toBe(2)
    // Extracción por archivo (ratificado F0): 1 llamada LLM por archivo
    expect(extractKnowledgeFromText).toHaveBeenCalledTimes(2)
  })

  it('fallo total de extracción → terminal failed con error_reason', async () => {
    const reportRow = {
      id: FAKE_UUIDS.report,
      business_id: FAKE_UUIDS.business,
      files_total: 1,
      files_done: 0,
      files_processed: [{ name: 'a.txt', size: 4, type: 'text/plain', storage_path: 'learning/r/0-a.txt' }],
    }
    makeAdminMock({
      reportRow: { id: FAKE_UUIDS.report, status: 'processing', processing_token: 'token-ok' },
      leased: reportRow,
    })
    vi.mocked(extractKnowledgeFromText).mockRejectedValue(new Error('OpenAI down'))
    vi.mocked(extractTextFromFile).mockRejectedValue(new Error('parse error'))

    const res = await processPost(
      new Request('http://localhost/api/knowledge/learn/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report_id: FAKE_UUIDS.report, token: 'token-ok' }),
      })
    )
    const data = await res.json()

    expect(data.success).toBe(false)
    expect(data.status).toBe('failed')
    expect(extractKnowledgeFromText).not.toHaveBeenCalled()
  })

  it('Vercel Cron trigger (x-vercel-cron:1) procesa el reporte pendiente más antiguo', async () => {
    makeAdminMock({
      pending: [{ id: FAKE_UUIDS.report }],
      reportRow: { id: FAKE_UUIDS.report, status: 'processing', processing_token: 'token-ok' },
      leased: {
        id: FAKE_UUIDS.report,
        business_id: FAKE_UUIDS.business,
        files_total: 1,
        files_done: 0,
        files_processed: [{ name: 'c.txt', size: 4, type: 'text/plain', storage_path: 'learning/r/0-c.txt' }],
      },
    })

    // Modo cron: sin body, solo header Vercel.
    const res = await processPost(
      new Request('http://localhost/api/knowledge/learn/process', {
        method: 'POST',
        headers: { 'x-vercel-cron': '1' },
      })
    )
    const data = await res.json()

    expect(data.success).toBe(true)
    expect(data.status).toBe('completed')
    expect(extractKnowledgeFromText).toHaveBeenCalledTimes(1)
  })
})

