import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * TASK-20260209-ASYNCLEARN001 (F1): recepción-only.
 * Este endpoint YA NO procesa archivos: valida, persiste los archivos en
 * Storage, crea el learning_report en 'processing' y devuelve report_id de
 * inmediato. La extracción/IA corre en el worker asíncrono
 * (/api/knowledge/learn/process) con lease + estados terminales garantizados.
 */

const MAX_FILES = 10
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/', 'application/pdf', 'text/']

interface StoredFile {
  name: string
  size: number
  type: string
  storage_path: string
}

async function saveFileToStorage(
  admin: ReturnType<typeof createAdminClient>,
  reportId: string,
  index: number,
  file: File
): Promise<StoredFile> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80)
  const path = `learning/${reportId}/${index}-${safeName}`

  const { error } = await admin.storage
    .from('knowledge-media')
    .upload(path, buffer, { contentType: file.type })

  if (error) {
    throw new Error(`Failed to store "${file.name}": ${error.message}`)
  }

  return { name: file.name, size: file.size, type: file.type, storage_path: path }
}

/** Dispara el worker sin bloquear la respuesta (fire-and-forget). */
function triggerWorker(reportId: string, token: string): void {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  void fetch(`${origin}/api/knowledge/learn/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ report_id: reportId, token }),
  }).catch((err) => {
    // Self-heal: el polling del frontend y el lease expirado permiten
    // re-disparar el procesamiento si este trigger se pierde.
    console.error('[learn] worker trigger failed (self-heal available):', err)
  })
}


export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const businessId = formData.get('business_id') as string
  if (!businessId) {
    return NextResponse.json({ error: 'business_id required' }, { status: 400 })
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

  const files: File[] = []
  for (const [key, value] of formData.entries()) {
    if (key === 'business_id') continue
    if (value instanceof File) {
      files.push(value)
    }
  }

  if (files.length === 0) {
    return NextResponse.json({ error: 'No files provided' }, { status: 400 })
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Maximum ${MAX_FILES} files allowed` }, { status: 400 })
  }

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File "${file.name}" exceeds 10MB limit` }, { status: 400 })
    }
    const isAllowed = ALLOWED_TYPES.some((t) => file.type.startsWith(t) || file.type === t)
    if (!isAllowed) {
      return NextResponse.json({ error: `File type "${file.type}" not supported` }, { status: 400 })
    }
  }

  const admin = createAdminClient()

  const processingToken = crypto.randomUUID()

  const { data: report, error: reportError } = await admin
    .from('learning_reports')
    .insert({
      business_id: businessId,
      status: 'processing',
      files_total: files.length,
      files_done: 0,
      processing_token: processingToken,
      files_processed: files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
    })
    .select('id')
    .single()

  if (reportError || !report) {
    return NextResponse.json({ error: 'Failed to create report' }, { status: 500 })
  }

  // F1: persistir archivos y responder INMEDIATAMENTE. Cero trabajo pesado.
  try {
    const stored: StoredFile[] = []
    for (let i = 0; i < files.length; i++) {
      stored.push(await saveFileToStorage(admin, report.id, i, files[i]))
    }

    await admin
      .from('learning_reports')
      .update({ files_processed: stored })
      .eq('id', report.id)

    triggerWorker(report.id, processingToken)

    return NextResponse.json({
      report_id: report.id,
      status: 'processing',
      files_total: files.length,
    })
  } catch (error) {
    await admin
      .from('learning_reports')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_reason: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', report.id)

    return NextResponse.json({
      error: 'No pude guardar los archivos. Intenta de nuevo.',
      detail: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

