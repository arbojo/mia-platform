import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { InvalidUrlError, UnsafeHostError } from '@/lib/import/ssrf'
import { fetchSourceRows } from '@/lib/import/sourceClient'
import { normalizeRows } from '@/lib/import/validators'
import { upsertRows, TooManyRowsError } from '@/lib/import/engine'
import { emptySummary, type ImportSummary, type PreviewResult, type SourceMethod } from '@/lib/import/types'
import { invalidateSystemContext } from '@/lib/cache/invalidator'

export const runtime = 'nodejs'

const PREVIEW_LIMIT = 20

const sourceBodySchema = z.object({
  business_id: z.string().uuid('business_id inválido'),
  method: z.enum(['woocommerce', 'feed', 'scrape']),
  url: z.string().url('URL inválida').max(2000),
  mode: z.enum(['preview', 'import']).default('preview'),
  credentials: z
    .object({
      consumerKey: z.string().optional(),
      consumerSecret: z.string().optional(),
    })
    .optional(),
  selectors: z
    .object({
      card: z.string().max(200).optional(),
    })
    .optional(),
})

function mapFetchError(error: unknown): { message: string; status: number } {
  if (error instanceof InvalidUrlError) return { message: error.message, status: 400 }
  if (error instanceof UnsafeHostError) return { message: error.message, status: 400 }
  return { message: (error as Error).message, status: 502 }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo JSON inválido' }, { status: 400 })
  }

  const parsed = sourceBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Cuerpo inválido' }, { status: 400 })
  }

  const { business_id, method, url, mode, credentials, selectors } = parsed.data

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', business_id)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let rawRows
  try {
    rawRows = await fetchSourceRows(method, url, {
      woocommerce: credentials?.consumerKey
        ? { baseUrl: url, consumerKey: credentials.consumerKey, consumerSecret: credentials.consumerSecret }
        : undefined,
      scrape: selectors?.card ? { cardSelector: selectors.card } : undefined,
    })
  } catch (error) {
    const mapped = mapFetchError(error)
    return NextResponse.json({ error: mapped.message }, { status: mapped.status })
  }

  if (rawRows.length === 0) {
    return NextResponse.json({ error: 'No se encontraron productos en la fuente' }, { status: 422 })
  }

  const normalized = normalizeRows(rawRows, { stockColumnPresent: false, rowBase: 1 })

  if (normalized.rows.length === 0) {
    return NextResponse.json(
      {
        error: 'No se encontraron filas válidas para importar',
        errors: normalized.errors,
      },
      { status: 422 }
    )
  }

  if (mode === 'preview') {
    const preview: PreviewResult = {
      rows: normalized.rows.slice(0, PREVIEW_LIMIT),
      total: normalized.rows.length,
      skipped: normalized.skipped,
      errors: normalized.errors,
      stockDropped: normalized.stockDropped,
      method: method as SourceMethod,
      source: url,
    }
    return NextResponse.json({ preview })
  }

  const summary: ImportSummary = emptySummary()
  summary.skipped += normalized.skipped
  summary.stockDropped += normalized.stockDropped
  summary.errors.push(...normalized.errors)

  try {
    const result = await upsertRows({
      rows: normalized.rows,
      rowBase: 1,
      stockColumnPresent: false,
      businessId: business_id,
      admin: createAdminClient(),
      initialSummary: summary,
    })
    invalidateSystemContext(business_id)
    return NextResponse.json({ summary: result })
  } catch (error) {
    if (error instanceof TooManyRowsError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
