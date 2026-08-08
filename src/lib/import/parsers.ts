import { parse } from 'csv-parse/sync'
import readXlsxFile from 'read-excel-file/node'
import type { RawRow } from './types'

export type Cell = string | number | boolean | Date | null

const FIELD_ALIASES: Record<keyof RawRow, string[]> = {
  name: [
    'nombre',
    'name',
    'titulo',
    'title',
    'producto',
    'product',
    'articulo',
    'article',
    'productname',
    'item',
    'itemname',
  ],
  sku: ['sku', 'codigo', 'code', 'reference', 'referencia', 'skucode', 'ref'],
  price: ['precio', 'price', 'costo', 'cost', 'precioventa', 'sellingprice', 'amount', 'precioventadetal',
    'regularprice', 'unitprice'],
  description: ['descripcion', 'description', 'desc', 'detalle', 'detail', 'productdescription', 'body'],
  benefits: ['beneficios', 'benefits', 'caracteristicas', 'features', 'usp', 'atractivos'],
  imageUrl: [
    'imagen',
    'image',
    'foto',
    'photo',
    'url',
    'urlimagen',
    'imageurl',
    'imagenurl',
    'imagenprincipal',
    'mainimage',
    'thumbnail',
    'featuredimage',
    'productimage',
    'photourl',
    'img',
    'pictures',
    'imagenes',
  ],
  stock: [
    'stock',
    'inventory',
    'cantidad',
    'quantity',
    'existencias',
    'units',
    'qty',
    'inventario',
    'disponibilidad',
  ],
}

export function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

export function resolveField(normalizedHeader: string): keyof RawRow | null {
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.includes(normalizedHeader)) return field as keyof RawRow
  }
  return null
}

export function cellToString(cell: Cell): string {
  if (cell === null || cell === undefined) return ''
  if (cell instanceof Date) return cell.toISOString()
  return String(cell).trim()
}

const FORMULA_PREFIX = /^[=+\-@]/

export function sanitizeText(value: string): string {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value
}

export function parseCsv(text: string): Cell[][] {
  return parse(text, {
    bom: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
    encoding: 'utf-8',
  }) as Cell[][]
}

export async function parseXlsx(buffer: Buffer): Promise<Cell[][]> {
  const sheets = await readXlsxFile(buffer)
  return (sheets[0]?.data ?? []) as unknown as Cell[][]
}

export function isXlsxBuffer(buffer: Buffer): boolean {
  return buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04
}

export function looksLikeCsv(buffer: Buffer): boolean {
  return !buffer.includes(0x00)
}

export interface ParsedFile {
  rows: RawRow[]
  stockColumnPresent: boolean
  format: 'csv' | 'xlsx'
}

export function buildRawRows(records: Cell[][]): { rows: RawRow[]; stockColumnPresent: boolean } {
  if (records.length === 0) return { rows: [], stockColumnPresent: false }

  const headerRow = records[0]
  const fields: (keyof RawRow | null)[] = headerRow.map((cell) => resolveField(normalizeHeader(cellToString(cell))))
  const stockColumnPresent = fields.includes('stock')

  const rows: RawRow[] = []
  for (let i = 1; i < records.length; i++) {
    const record = records[i]
    if (record.length === 0 || record.every((cell) => cell === null || cell === undefined || String(cell).trim() === '')) {
      continue
    }
    const row: RawRow = {}
    fields.forEach((field, colIndex) => {
      if (!field) return
      const cell = record[colIndex]
      if (cell === null || cell === undefined) return
      if (field === 'price' || field === 'stock') {
        row[field] = typeof cell === 'number' ? cell : String(cell)
      } else {
        row[field] = sanitizeText(String(cell))
      }
    })
    rows.push(row)
  }

  return { rows, stockColumnPresent }
}

export class UnsupportedFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsupportedFormatError'
  }
}

export async function parseImportFile(buffer: Buffer, filename: string): Promise<ParsedFile> {
  const lower = filename.toLowerCase()

  if (lower.endsWith('.csv')) {
    if (!looksLikeCsv(buffer)) {
      throw new UnsupportedFormatError('El archivo CSV contiene datos binarios o está corrupto')
    }
    const text = new TextDecoder('utf-8').decode(buffer)
    return { ...buildRawRows(parseCsv(text)), format: 'csv' }
  }

  if (lower.endsWith('.xlsx')) {
    if (!isXlsxBuffer(buffer)) {
      throw new UnsupportedFormatError('El archivo no es un XLSX válido (firma ZIP no encontrada)')
    }
    const records = await parseXlsx(buffer)
    return { ...buildRawRows(records), format: 'xlsx' }
  }

  throw new UnsupportedFormatError('Formato no soportado. Usa .csv o .xlsx')
}
