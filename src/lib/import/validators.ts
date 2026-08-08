import { z } from 'zod'
import type { NormalizedRow, RawRow, ImportError, ImportSummary } from './types'

export const MAX_NAME = 200
export const MAX_SKU = 64
export const MAX_TEXT = 5000
export const MAX_IMAGE_URL = 2000

const IMAGE_URL_PATTERN = /^https?:\/\/\S+$/i

export const productRowSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'El nombre es requerido')
    .max(MAX_NAME, `Nombre demasiado largo (máx ${MAX_NAME})`),
  sku: z.string().trim().max(MAX_SKU, `SKU demasiado largo (máx ${MAX_SKU})`).nullable().optional(),
  price: z
    .number()
    .min(0, 'El precio no puede ser negativo')
    .max(999_999_999, 'Precio fuera de rango')
    .nullable()
    .optional(),
  description: z.string().trim().max(MAX_TEXT, 'Descripción demasiado larga').nullable().optional(),
  benefits: z.string().trim().max(MAX_TEXT, 'Beneficios demasiado largos').nullable().optional(),
  imageUrl: z
    .string()
    .max(MAX_IMAGE_URL, 'URL de imagen demasiado larga')
    .nullable()
    .optional(),
})

export type ProductRowInput = z.input<typeof productRowSchema>
export type ProductRow = z.output<typeof productRowSchema>

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function normalizeNumberString(raw: string): string {
  const hasDot = raw.includes('.')
  const hasComma = raw.includes(',')
  if (hasDot && hasComma) {
    if (raw.lastIndexOf('.') > raw.lastIndexOf(',')) {
      return raw.replace(/,/g, '')
    }
    return raw.replace(/\./g, '').replace(',', '.')
  }
  if (hasComma) {
    const parts = raw.split(',')
    if (parts.length === 2 && parts[1].length <= 2 && parts[0].length <= 3) {
      return raw.replace(',', '.')
    }
    return raw.replace(/,/g, '')
  }
  return raw
}

export function parsePrice(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null
    return round2(value)
  }
  const cleaned = value.trim().replace(/[^\d.,-]/g, '')
  if (!cleaned || cleaned === '-') return null
  const num = Number(normalizeNumberString(cleaned))
  if (!Number.isFinite(num) || num < 0) return null
  return round2(num)
}

export function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text ? text : null
}

export interface NormalizeOptions {
  stockColumnPresent: boolean
  rowBase?: number
}

export interface NormalizeResult {
  rows: NormalizedRow[]
  errors: ImportError[]
  skipped: number
  stockDropped: number
}

export function normalizeRows(rawRows: RawRow[], options: NormalizeOptions): NormalizeResult {
  const rows: NormalizedRow[] = []
  const errors: ImportError[] = []
  let skipped = 0
  let stockDropped = 0
  const rowBase = options.rowBase ?? 2

  rawRows.forEach((raw, index) => {
    const rowNumber = index + rowBase

    const name = cleanText(raw.name)
    if (!name) {
      skipped += 1
      errors.push({ row: rowNumber, message: 'Fila sin nombre: se omitió' })
      return
    }

    if (name.length > MAX_NAME) {
      skipped += 1
      errors.push({ row: rowNumber, message: `Nombre demasiado largo (máx ${MAX_NAME}): se omitió` })
      return
    }

    const sku = cleanText(raw.sku)?.slice(0, MAX_SKU) ?? null

    let price: number | null = null
    if (raw.price !== null && raw.price !== undefined && String(raw.price).trim() !== '') {
      const parsed = parsePrice(raw.price)
      if (parsed === null) {
        skipped += 1
        errors.push({
          row: rowNumber,
          message: `Precio inválido: "${String(raw.price).trim()}". Se omitió la fila`,
          sku: sku ?? undefined,
        })
        return
      }
      price = parsed
    }

    const description = cleanText(raw.description)?.slice(0, MAX_TEXT) ?? null
    const benefits = cleanText(raw.benefits)?.slice(0, MAX_TEXT) ?? null

    let imageUrl: string | null = null
    const rawImage = cleanText(raw.imageUrl)
    if (rawImage) {
      if (rawImage.length > MAX_IMAGE_URL) {
        skipped += 1
        errors.push({
          row: rowNumber,
          message: 'URL de imagen demasiado larga. Se omitió la fila',
          sku: sku ?? undefined,
        })
        return
      }
      if (!IMAGE_URL_PATTERN.test(rawImage)) {
        skipped += 1
        errors.push({
          row: rowNumber,
          message: `URL de imagen inválida: "${rawImage.slice(0, 80)}". Se omitió la fila`,
          sku: sku ?? undefined,
        })
        return
      }
      imageUrl = rawImage
    }

    if (options.stockColumnPresent && raw.stock !== null && raw.stock !== undefined && String(raw.stock).trim() !== '') {
      stockDropped += 1
    }

    rows.push({
      name,
      sku,
      price,
      description,
      benefits,
      imageUrl,
    })
  })

  return { rows, errors, skipped, stockDropped }
}

export function mergeErrorCounts(summary: ImportSummary, result: NormalizeResult): ImportSummary {
  summary.total += result.rows.length + result.skipped
  summary.skipped += result.skipped
  summary.stockDropped += result.stockDropped
  summary.errors.push(...result.errors)
  return summary
}
