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

    // NEW: Always create/overwrite a knowledge_items row for the product image.
    // The product's own image_url column is deprecated — no UI or engine write should
    // set it as the authoritative source. All product images flow through knowledge_items.
    if (existingId) {
      // Update existing product (keep image_url column as-is for backward compat,
      // but it is no longer the authoritative source)
      const { error } = await input.admin
        .from('products')
        .update({ image_url: row.imageUrl })
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

      // Also ensure knowledge_items row exists and is consistent
      const { error: kiError } = await input.admin
        .from('knowledge_items')
        .upsert({
          product_id: existingId,
          image_url: row.imageUrl,
          trigger_condition: null,
          media_type: 'image',
          business_id: input.businessId,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      if (kiError) {
        summary.errors.push({
          row: rowNumber,
          message: `Error al crear knowledge_item: ${kiError.message}`,
        })
      }
    } else {
      // Insert new product
      const { data: createdProduct, error } = await input.admin
        .from('products')
        .insert({ name: row.name, sku: row.sku, price: row.price, description: row.description, benefits: row.benefits, image_url: row.imageUrl, business_id: input.businessId })
        .select()
        .single()
      if (error) {
        failed += 1
        summary.errors.push({
          row: rowNumber,
          message: `Error al crear: ${error.message}`,
          sku: row.sku ?? undefined,
        })
        continue
      }

      const createdId = (createdProduct as ExistingProduct | null)?.id
      if (!createdId) {
        failed += 1
        summary.errors.push({
          row: rowNumber,
          message: 'Error al crear: el insert no devolvió el id del producto',
          sku: row.sku ?? undefined,
        })
        continue
      }
      summary.created += 1

      // Also create knowledge_items row for the new product, scoped to the created id
      const { error: kiError } = await input.admin
        .from('knowledge_items')
        .upsert({
          product_id: createdId,
          image_url: row.imageUrl,
          trigger_condition: null,
          media_type: 'image',
          business_id: input.businessId,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      if (kiError) {
        summary.errors.push({
          row: rowNumber,
          message: `Error al crear knowledge_item: ${kiError.message}`,
        })
      }
    }
  }

  summary.total = summary.created + summary.updated + summary.skipped + failed
  return summary
}
