import type { SupabaseClient } from '@supabase/supabase-js'
import type { ImportSummary, NormalizedRow } from './types'
import { emptySummary } from './types'

export const MAX_IMPORT_ROWS = 500

export class TooManyRowsError extends Error {
  constructor(count: number) {
    super(`El importe supera el límite de ${MAX_IMPORT_ROWS} productos (recibidos: ${count})`)
    this.name = 'TooManyRowsError'
  }
}

export interface UpsertInput {
  rows: NormalizedRow[]
  rowBase: number
  stockColumnPresent: boolean
  businessId: string
  admin: SupabaseClient
  initialSummary?: ImportSummary
}

interface ExistingProduct {
  id: string
  sku: string | null
}

export async function upsertRows(input: UpsertInput): Promise<ImportSummary> {
  const summary = input.initialSummary ?? emptySummary()
  summary.stockColumnPresent = input.stockColumnPresent

  if (input.rows.length === 0) return summary
  if (input.rows.length > MAX_IMPORT_ROWS) throw new TooManyRowsError(input.rows.length)

  const seenSkus = new Set<string>()
  const validRows: NormalizedRow[] = []
  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i]
    if (row.sku) {
      const key = row.sku.toLowerCase()
      if (seenSkus.has(key)) {
        summary.skipped += 1
        summary.errors.push({
          row: input.rowBase + i,
          message: 'SKU duplicado en el origen: se omitió',
          sku: row.sku,
        })
        continue
      }
      seenSkus.add(key)
    }
    validRows.push(row)
  }

  const { data: existing, error: fetchError } = await input.admin
    .from('products')
    .select('id, sku')
    .eq('business_id', input.businessId)

  if (fetchError) throw fetchError

  const skuToId = new Map<string, string>()
  for (const product of (existing ?? []) as ExistingProduct[]) {
    if (product.sku) skuToId.set(product.sku.toLowerCase(), product.id)
  }

  let failed = 0

  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i]
    const rowNumber = input.rowBase + i
    const existingId = row.sku ? skuToId.get(row.sku.toLowerCase()) : undefined

    const payload = {
      name: row.name,
      sku: row.sku,
      price: row.price,
      description: row.description,
      benefits: row.benefits,
      image_url: row.imageUrl,
    }

    if (existingId) {
      const { error } = await input.admin
        .from('products')
        .update(payload)
        .eq('id', existingId)
        .eq('business_id', input.businessId)
      if (error) {
        failed += 1
        summary.errors.push({
          row: rowNumber,
          message: `Error al actualizar: ${error.message}`,
          sku: row.sku ?? undefined,
        })
        continue
      }
      summary.updated += 1
    } else {
      const { error } = await input.admin
        .from('products')
        .insert({ ...payload, business_id: input.businessId })
      if (error) {
        failed += 1
        summary.errors.push({
          row: rowNumber,
          message: `Error al crear: ${error.message}`,
          sku: row.sku ?? undefined,
        })
        continue
      }
      summary.created += 1
    }
  }

  summary.total = summary.created + summary.updated + summary.skipped + failed
  return summary
}
