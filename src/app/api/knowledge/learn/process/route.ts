import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { extractKnowledgeFromText, type ExtractionResult } from '@/lib/ai/extract'
import { getBusinessExtractionContext } from '@/lib/ai/knowledge'
import { extractTextFromFile } from '@/lib/knowledge/file-extract'

/**
 * TASK-20260209-ASYNCLEARN001 (F2) — Worker asíncrono de ingesta de conocimiento.
 *
 * Dos modos de invocación:
 *  1. Token mode (inmediato): { report_id, token } — el token lo genera la
 *     recepción (processing_token) y es de un solo uso por reporte.
 *  2. Cron mode (red de seguridad): header x-mia-cron-secret — toma el reporte
 *     'processing' más antiguo con lease expirado/inexistente.
 *
 * Garantías: lease atómico (locked_at/locked_expire_at), progreso granular
 * (files_done), estado terminal SIEMPRE (completed|failed) vía try/catch/finally.
 */

const LEASE_MINUTES = 15

/**
 * Authorized when either:
 *  - internal test/self-heal uses MIA_CRON_SECRET (x-mia-cron-secret), or
 *  - Vercel Cron invokes with x-vercel-cron:1 (auto header, not spoofable).
 */
function verifyCronAuth(request: Request): boolean {
  const vercelCron = request.headers.get('x-vercel-cron')
  if (vercelCron === '1') return true

  const secret = request.headers.get('x-mia-cron-secret')
  const expected = process.env.MIA_CRON_SECRET
  return Boolean(secret && expected && secret === expected)
}

function emptyResult(): ExtractionResult {
  return {
    products: [],
    knowledge: [],
    rules: [],
    missingFields: [],
    summary: {
      productsFound: 0,
      pricesFound: 0,
      benefitsFound: 0,
      faqsFound: 0,
      promotionsFound: 0,
      knowledgeFound: 0,
      rulesFound: 0,
    },
  }
}

function mergeResults(acc: ExtractionResult, next: ExtractionResult): ExtractionResult {
  return {
    products: [...acc.products, ...next.products],
    knowledge: [...acc.knowledge, ...next.knowledge],
    rules: [...acc.rules, ...next.rules],
    missingFields: [...acc.missingFields, ...next.missingFields],
    summary: {
      productsFound: acc.summary.productsFound + next.summary.productsFound,
      pricesFound: acc.summary.pricesFound + next.summary.pricesFound,
      benefitsFound: acc.summary.benefitsFound + next.summary.benefitsFound,
      faqsFound: acc.summary.faqsFound + next.summary.faqsFound,
      promotionsFound: acc.summary.promotionsFound + next.summary.promotionsFound,
      knowledgeFound: acc.summary.knowledgeFound + next.summary.knowledgeFound,
      rulesFound: acc.summary.rulesFound + next.summary.rulesFound,
    },
  }
}

interface ReportFile {
  name: string
  size: number
  type: string
  storage_path: string
}

export async function POST(request: Request) {
  const admin = createAdminClient()
  const runId = randomUUID()
  let reportId: string | null = null

  try {
    const cronMode = verifyCronAuth(request)

    if (cronMode) {
      const cutoff = new Date(Date.now() - LEASE_MINUTES * 60_000).toISOString()
      const { data: pending } = await admin
        .from('learning_reports')
        .select('id')
        .eq('status', 'processing')
        .or(`locked_at.is.null,locked_expire_at.lt.${cutoff}`)
        .order('created_at', { ascending: true })
        .limit(1)

      if (!pending || pending.length === 0) {
        return NextResponse.json({ success: true, processed: 0 })
      }
      reportId = pending[0].id
    } else {
      const body = await request.json().catch(() => null)
      reportId = (body as { report_id?: string } | null)?.report_id ?? null
      const token = (body as { token?: string } | null)?.token ?? null

      if (!reportId || !token) {
        return NextResponse.json({ error: 'report_id and token required' }, { status: 400 })
      }

      const { data: report } = await admin
        .from('learning_reports')
        .select('id, status, processing_token')
        .eq('id', reportId)
        .single()

      if (!report || report.status !== 'processing' || report.processing_token !== token) {
        return NextResponse.json({ error: 'Invalid report or token' }, { status: 403 })
      }
    }

    // ── Lease atómico: solo una ejecución puede reclamar el reporte ─────────
    const nowIso = new Date().toISOString()
    const expireIso = new Date(Date.now() + LEASE_MINUTES * 60_000).toISOString()
    const cutoff = new Date(Date.now() - LEASE_MINUTES * 60_000).toISOString()

    const { data: leased } = await admin
      .from('learning_reports')
      .update({ locked_at: nowIso, locked_by: runId, locked_expire_at: expireIso })
      .eq('id', reportId)
      .eq('status', 'processing')
      .or(`locked_at.is.null,locked_expire_at.lt.${cutoff}`)
      .select('id, business_id, files_processed, files_total, files_done')
      .single()

    if (!leased) {
      // Otro worker tiene el lease vigente o el reporte ya no está processing.
      return NextResponse.json({ success: true, leased: false })
    }

    const storedFiles = (leased.files_processed ?? []) as unknown as ReportFile[]
    const total = leased.files_total || storedFiles.length

    // ── Procesamiento por archivo (incremental, ratificado F0) ──────────────
    const extractionCtx = await getBusinessExtractionContext(leased.business_id)
    const businessContext = [
      'Productos existentes:', extractionCtx.existingProducts.join(', ') || 'Ninguno',
      'Conocimiento existente:', extractionCtx.existingKnowledge.map((k) => `${k.category}: ${k.content}`).join('; ') || 'Ninguno',
      'Reglas existentes:', extractionCtx.existingRules.map((r) => `${r.category}: ${r.content}`).join('; ') || 'Ninguna',
    ].join('\n')

    let acc = emptyResult()
    let processed = leased.files_done || 0
    let anyText = false
    const fileErrors: string[] = []

    for (const [index, sf] of storedFiles.entries()) {
      if (index < processed) continue // ya procesado por una ejecución previa

      try {
        const { data: blob, error: dlError } = await admin.storage
          .from('knowledge-media')
          .download(sf.storage_path)

        if (dlError || !blob) {
          throw new Error(`storage download failed: ${dlError?.message ?? 'empty'}`)
        }

        const buffer = await blob.arrayBuffer()
        const text = await extractTextFromFile({
          arrayBuffer: () => Promise.resolve(buffer),
          type: sf.type,
          name: sf.name,
        })

        if (text.trim().length > 0) {
          anyText = true
          const partial = await extractKnowledgeFromText(
            `--- Archivo: ${sf.name} ---\n${text}`,
            businessContext,
            leased.business_id,
            leased.business_id
          )
          acc = mergeResults(acc, partial)
        }
      } catch (err) {
        // Un archivo fallido NO tumba el reporte: se registra y se continúa.
        const msg = err instanceof Error ? err.message : 'Unknown error'
        fileErrors.push(`${sf.name}: ${msg}`)
        console.error(`[learn-worker] file failed (${sf.name}):`, msg)
      }

      processed = index + 1
      await admin
        .from('learning_reports')
        .update({ files_done: processed })
        .eq('id', reportId)
    }

    // ── Estado terminal garantizado ──────────────────────────────────────────
    if (!anyText) {
      await admin
        .from('learning_reports')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_reason:
            fileErrors.length > 0
              ? `No pude leer ningún archivo. Detalles: ${fileErrors.join(' | ')}`
              : 'No pude leer información de los archivos. Asegúrate de que contengan texto visible.',
        })
        .eq('id', reportId)

      return NextResponse.json({ success: false, status: 'failed', fileErrors })
    }

    const preparationAfter = Math.min(100,
      acc.summary.productsFound * 3 +
      acc.summary.knowledgeFound * 2 +
      acc.summary.rulesFound * 2 +
      acc.summary.faqsFound
    )

    await admin
      .from('learning_reports')
      .update({
        status: 'completed',
        products_found: acc.summary.productsFound,
        knowledge_found: acc.summary.knowledgeFound,
        rules_found: acc.summary.rulesFound,
        prices_found: acc.summary.pricesFound,
        benefits_found: acc.summary.benefitsFound,
        faqs_found: acc.summary.faqsFound,
        promotions_found: acc.summary.promotionsFound,
        missing_fields: acc.missingFields,
        extracted_products: acc.products,
        extracted_knowledge: acc.knowledge,
        extracted_rules: acc.rules,
        preparation_after: preparationAfter,
        completed_at: new Date().toISOString(),
        error_reason: fileErrors.length > 0 ? `Archivos con errores parciales: ${fileErrors.join(' | ')}` : null,
      })
      .eq('id', reportId)

    return NextResponse.json({
      success: true,
      status: 'completed',
      files_total: total,
      files_done: processed,
      partialErrors: fileErrors,
    })
  } catch (error) {
    // Estado terminal SIEMPRE: si el worker explota, el reporte no queda zombi.
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[learn-worker] fatal:', msg)

    if (reportId) {
      await admin
        .from('learning_reports')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_reason: `Worker error: ${msg}`,
        })
        .eq('id', reportId)
    }

    return NextResponse.json({ error: 'Worker failed', detail: msg }, { status: 500 })
  }
}
