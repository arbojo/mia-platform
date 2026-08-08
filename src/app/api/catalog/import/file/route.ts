import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseImportFile, isXlsxBuffer, looksLikeCsv, UnsupportedFormatError } from '@/lib/import/parsers'
import { normalizeRows, mergeErrorCounts } from '@/lib/import/validators'
import { upsertRows, TooManyRowsError } from '@/lib/import/engine'
import { emptySummary } from '@/lib/import/types'

export const runtime = 'nodejs'

const MAX_FILE_SIZE = 5 * 1024 * 1024

const ALLOWED_MIMES = new Set([
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
])

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido: se esperaba multipart/form-data' }, { status: 400 })
  }

  const businessId = formData.get('business_id')
  const file = formData.get('file')

  if (typeof businessId !== 'string' || !businessId) {
    return NextResponse.json({ error: 'business_id requerido' }, { status: 400 })
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Archivo requerido (campo "file")' }, { status: 400 })
  }

  if (file.size === 0) {
    return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: 'El archivo supera el máximo de 5 MB' }, { status: 400 })
  }

  const extension = file.name.toLowerCase().split('.').pop()
  if (extension !== 'csv' && extension !== 'xlsx') {
    return NextResponse.json({ error: 'Formato no soportado. Usa .csv o .xlsx' }, { status: 400 })
  }

  const mime = file.type.toLowerCase()
  if (!ALLOWED_MIMES.has(mime)) {
    return NextResponse.json({ error: `Tipo de archivo no permitido: ${mime || 'desconocido'}` }, { status: 400 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .eq('owner_id', user.id)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  if (extension === 'xlsx' && !isXlsxBuffer(buffer)) {
    return NextResponse.json({ error: 'El archivo no es un XLSX válido (firma ZIP no encontrada)' }, { status: 400 })
  }
  if (extension === 'csv' && !looksLikeCsv(buffer)) {
    return NextResponse.json({ error: 'El archivo CSV contiene datos binarios o está corrupto' }, { status: 400 })
  }

  let parsed: Awaited<ReturnType<typeof parseImportFile>>
  try {
    parsed = await parseImportFile(buffer, file.name)
  } catch (error) {
    if (error instanceof UnsupportedFormatError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    return NextResponse.json({ error: `No se pudo leer el archivo: ${(error as Error).message}` }, { status: 422 })
  }

  const normalized = normalizeRows(parsed.rows, {
    stockColumnPresent: parsed.stockColumnPresent,
    rowBase: 2,
  })

  if (normalized.rows.length === 0) {
    return NextResponse.json(
      {
        error: 'No se encontraron filas válidas para importar',
        summary: { ...mergeErrorCounts(emptySummary(), normalized), created: 0, updated: 0 },
      },
      { status: 422 }
    )
  }

  const summary = mergeErrorCounts(emptySummary(), normalized)

  try {
    const result = await upsertRows({
      rows: normalized.rows,
      rowBase: 2,
      stockColumnPresent: parsed.stockColumnPresent,
      businessId,
      admin: createAdminClient(),
      initialSummary: summary,
    })
    return NextResponse.json({ summary: result })
  } catch (error) {
    if (error instanceof TooManyRowsError) {
      return NextResponse.json({ error: error.message }, { status: 422 })
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
