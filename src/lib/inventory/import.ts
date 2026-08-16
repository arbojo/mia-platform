import { parseImportFile } from '@/lib/import/parsers'
import { MAX_IMPORT_ROWS } from '@/lib/import/engine'
import { createInventoryAdmin } from './db'
import { createAdminClient } from '@/lib/supabase/admin'

export interface StockImportRow {
  sku: string
  quantity: number
}

export interface StockImportError {
  row: number
  message: string
  sku?: string
}

export interface StockImportSummary {
  total: number
  applied: number
  skipped: number
  errors: StockImportError[]
}

export function parseQuantity(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  return Number.isFinite(n) && n >= 0 && Number.isInteger(n) ? n : null
}

export function buildImportRows(
  rawRows: { sku?: string; stock?: string | number | null }[],
  rowOffset: number
): { rows: StockImportRow[]; errors: StockImportError[] } {
  const rows: StockImportRow[] = []
  const errors: StockImportError[] = []

  rawRows.forEach((raw, index) => {
    const rowNumber = rowOffset + index
    const sku = (raw.sku ?? '').trim()
    const quantity = parseQuantity(raw.stock)

    if (!sku) {
      errors.push({ row: rowNumber, message: 'Fila sin SKU: se omitió' })
      return
    }
    if (quantity === null) {
      errors.push({ row: rowNumber, message: 'Cantidad de stock inválida o ausente', sku })
      return
    }

    rows.push({ sku, quantity })
  })

  return { rows, errors }
}

export async function applyStockImport(
  businessId: string,
  buffer: Buffer,
  filename: string,
  actorId: string
): Promise<StockImportSummary> {
  const parsed = await parseImportFile(buffer, filename)

  if (parsed.rows.length > MAX_IMPORT_ROWS) {
    throw new Error(`El importe supera el límite de ${MAX_IMPORT_ROWS} filas (recibidas: ${parsed.rows.length})`)
  }

  const { rows, errors } = buildImportRows(parsed.rows, 2)

  const summary: StockImportSummary = {
    total: parsed.rows.length,
    applied: 0,
    skipped: errors.length,
    errors: [...errors],
  }

  if (rows.length === 0) return summary

  const pub = createAdminClient()
  const { data: products, error: productsError } = await pub
    .from('products')
    .select('id, name, sku')
    .eq('business_id', businessId)

  if (productsError) throw productsError

  const skuToProduct = new Map<string, { id: string; name: string; sku: string | null }>()
  for (const product of (products ?? []) as Array<{ id: string; name: string; sku: string | null }>) {
    if (product.sku) skuToProduct.set(product.sku.toLowerCase(), product)
  }

  const inv = createInventoryAdmin()
  const now = new Date().toISOString()

  for (const row of rows) {
    const product = skuToProduct.get(row.sku.toLowerCase())

    if (!product) {
      summary.skipped += 1
      summary.errors.push({ row: 0, message: 'SKU no existe en el catálogo', sku: row.sku })
      continue
    }

    const { data: bridge } = await inv
      .from('asset_products')
      .select('asset_id')
      .eq('business_id', businessId)
      .eq('product_id', product.id)
      .maybeSingle()

    let assetId = bridge?.asset_id as string | undefined
    let nextVersion = 1

    if (!assetId) {
      const { data: newAsset, error: assetError } = await inv
        .from('assets')
        .insert({
          business_id: businessId,
          item_type: 'sku',
          tracking_mode: 'quantity',
          code: product.sku,
          name: product.name,
          attributes: { product_id: product.id },
          uom: 'u',
          lifecycle_state: 'active',
          current_qty: row.quantity,
          version: 1,
        })
        .select('id, version')
        .single()

      if (assetError) {
        summary.skipped += 1
        summary.errors.push({ row: 0, message: `Error al crear asset: ${assetError.message}`, sku: row.sku })
        continue
      }

      assetId = newAsset.id
      nextVersion = newAsset.version + 1

      const { error: bridgeError } = await inv.from('asset_products').insert({
        business_id: businessId,
        asset_id: assetId,
        product_id: product.id,
      })
      if (bridgeError) {
        summary.skipped += 1
        summary.errors.push({ row: 0, message: `Error de puente: ${bridgeError.message}`, sku: row.sku })
        continue
      }
    } else {
      const { data: existing } = await inv
        .from('assets')
        .select('version')
        .eq('business_id', businessId)
        .eq('id', assetId)
        .maybeSingle()

      nextVersion = (existing?.version ?? 0) + 1
    }

    const { error: upsertError } = await inv
      .from('assets')
      .update({ current_qty: row.quantity, version: nextVersion, updated_at: now })
      .eq('business_id', businessId)
      .eq('id', assetId)

    if (upsertError) {
      summary.skipped += 1
      summary.errors.push({ row: 0, message: `Error al guardar: ${upsertError.message}`, sku: row.sku })
      continue
    }

    const { error: movementError } = await inv.from('stock_movements').insert({
      business_id: businessId,
      product_id: product.id,
      asset_id: assetId,
      quantity_delta: row.quantity,
      movement_type: 'import',
      reference_type: 'import',
      reason: 'Importación masiva',
      created_by: actorId || null,
    })

    if (movementError) {
      summary.skipped += 1
      summary.errors.push({ row: 0, message: `Error de movimiento: ${movementError.message}`, sku: row.sku })
      continue
    }

    summary.applied += 1
  }

  return summary
}
