import { NextResponse } from 'next/server'
import { InventoryError } from '@/lib/inventory/errors'
import { requireInventoryAdmin } from '@/lib/inventory/admin-api'
import { assertInventoryHubEnabled } from '@/lib/inventory/licensing'
import { isXlsxBuffer, looksLikeCsv, UnsupportedFormatError } from '@/lib/import/parsers'
import { applyStockImport } from '@/lib/inventory/import'

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
  try {
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

    const { userId } = await requireInventoryAdmin(businessId)
    await assertInventoryHubEnabled(businessId)

    const buffer = Buffer.from(await file.arrayBuffer())

    if (extension === 'xlsx' && !isXlsxBuffer(buffer)) {
      return NextResponse.json({ error: 'El archivo no es un XLSX válido (firma ZIP no encontrada)' }, { status: 400 })
    }
    if (extension === 'csv' && !looksLikeCsv(buffer)) {
      return NextResponse.json({ error: 'El archivo CSV contiene datos binarios o está corrupto' }, { status: 400 })
    }

    try {
      const summary = await applyStockImport(businessId, buffer, file.name, userId)
      return NextResponse.json({ summary })
    } catch (error) {
      if (error instanceof UnsupportedFormatError) {
        return NextResponse.json({ error: error.message }, { status: 422 })
      }
      if (error instanceof Error && error.message.includes('límite')) {
        return NextResponse.json({ error: error.message }, { status: 422 })
      }
      return NextResponse.json({ error: (error as Error).message }, { status: 500 })
    }
  } catch (error) {
    if (error instanceof InventoryError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    console.error('Inventory import error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
