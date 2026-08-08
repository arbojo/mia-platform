export interface RawRow {
  name?: string
  sku?: string
  price?: string | number | null
  description?: string
  benefits?: string
  imageUrl?: string
  stock?: string | number | null
}

export interface NormalizedRow {
  name: string
  sku: string | null
  price: number | null
  description: string | null
  benefits: string | null
  imageUrl: string | null
}

export interface ImportError {
  row: number
  message: string
  sku?: string
}

export interface ImportSummary {
  total: number
  created: number
  updated: number
  skipped: number
  errors: ImportError[]
  stockDropped: number
  stockColumnPresent: boolean
}

export type SourceMethod = 'woocommerce' | 'feed' | 'scrape'
export type ImportMode = 'preview' | 'import'

export interface PreviewResult {
  rows: NormalizedRow[]
  total: number
  skipped: number
  errors: ImportError[]
  stockDropped: number
  method: SourceMethod
  source: string
}

export function emptySummary(): ImportSummary {
  return {
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    stockDropped: 0,
    stockColumnPresent: false,
  }
}
