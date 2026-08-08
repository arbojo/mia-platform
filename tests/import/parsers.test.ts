import { describe, it, expect } from 'vitest'
import {
  normalizeHeader,
  resolveField,
  parseCsv,
  buildRawRows,
  parseImportFile,
  isXlsxBuffer,
  looksLikeCsv,
  UnsupportedFormatError,
  cellToString,
  sanitizeText,
} from '@/lib/import/parsers'
import { buildXlsx } from './fixtures'

describe('normalizeHeader', () => {
  it('normaliza a minúsculas sin acentos ni símbolos', () => {
    expect(normalizeHeader('Descripción')).toBe('descripcion')
    expect(normalizeHeader('URL Imagen')).toBe('urlimagen')
    expect(normalizeHeader('  Precio Venta ')).toBe('precioventa')
  })
})

describe('resolveField', () => {
  it('mapea alias en español e inglés', () => {
    expect(resolveField('nombre')).toBe('name')
    expect(resolveField('sku')).toBe('sku')
    expect(resolveField('precio')).toBe('price')
    expect(resolveField('descripcion')).toBe('description')
    expect(resolveField('beneficios')).toBe('benefits')
    expect(resolveField('foto')).toBe('imageUrl')
    expect(resolveField('stock')).toBe('stock')
    expect(resolveField('categoría')).toBeNull()
  })
})

describe('cellToString', () => {
  it('convierte celdas a string y trimea', () => {
    expect(cellToString('  hola  ')).toBe('hola')
    expect(cellToString(42)).toBe('42')
    expect(cellToString(null)).toBe('')
  })
})

describe('parseCsv', () => {
  it('parsea CSV con BOM y comas en campos citados', () => {
    const text = '\uFEFFnombre,descripcion,precio\n"A, B",hola,10\n'
    const records = parseCsv(text)
    expect(records[0]).toEqual(['nombre', 'descripcion', 'precio'])
    expect(records[1][0]).toBe('A, B')
  })
})

describe('sanitizeText', () => {
  it('neutraliza prefijos de fórmula (injection)', () => {
    expect(sanitizeText('=HYPERLINK("x")')).toBe(`'=HYPERLINK("x")`)
    expect(sanitizeText('+SUM(A1)')).toBe(`'+SUM(A1)`)
    expect(sanitizeText('-cmd')).toBe(`'-cmd`)
    expect(sanitizeText('@SUM(A1)')).toBe(`'@SUM(A1)`)
    expect(sanitizeText('Perfume')).toBe('Perfume')
  })

  it('sanitiza fórmulas al construir filas', () => {
    const { rows } = buildRawRows([
      ['Nombre', 'Descripcion'],
      ['=1+1', '=cmd|/c calc!A0'],
    ])
    expect(rows[0].name).toBe(`'=1+1`)
    expect(rows[0].description).toBe(`'=cmd|/c calc!A0`)
  })
})

describe('buildRawRows', () => {
  it('mapea encabezados a campos y salta filas vacías', () => {
    const records = [
      ['Nombre', 'SKU', 'Precio', 'Foto'],
      ['Perfume', 'PER-1', 45, 'https://cdn.example.com/perfume.jpg'],
      [null, null, null],
      ['', '', ''],
    ]
    const { rows, stockColumnPresent } = buildRawRows(records)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({
      name: 'Perfume',
      sku: 'PER-1',
      price: 45,
      imageUrl: 'https://cdn.example.com/perfume.jpg',
    })
    expect(stockColumnPresent).toBe(false)
  })

  it('detecta la columna stock', () => {
    const { stockColumnPresent } = buildRawRows([
      ['Nombre', 'Stock'],
      ['Perfume', 10],
    ])
    expect(stockColumnPresent).toBe(true)
  })
})

describe('parseImportFile', () => {
  it('parsea CSV desde buffer', async () => {
    const buffer = Buffer.from('nombre,sku,precio\nPerfume,PER-1,45\n')
    const parsed = await parseImportFile(buffer, 'catalogo.csv')
    expect(parsed.format).toBe('csv')
    expect(parsed.rows).toHaveLength(1)
    expect(parsed.rows[0].name).toBe('Perfume')
  })

  it('parsea XLSX desde buffer', async () => {
    const buffer = buildXlsx([
      ['Nombre', 'SKU', 'Precio'],
      ['Perfume', 'PER-1', 45.5],
      ['Crema', 'CRE-2', 18],
    ])
    expect(isXlsxBuffer(buffer)).toBe(true)
    const parsed = await parseImportFile(buffer, 'catalogo.xlsx')
    expect(parsed.format).toBe('xlsx')
    expect(parsed.rows).toHaveLength(2)
    expect(parsed.rows[0]).toMatchObject({ name: 'Perfume', sku: 'PER-1', price: 45.5 })
    expect(parsed.rows[1]).toMatchObject({ name: 'Crema', price: 18 })
  })

  it('rechaza formatos no soportados', async () => {
    await expect(parseImportFile(Buffer.from('hola'), 'catalogo.txt')).rejects.toThrow(UnsupportedFormatError)
  })

  it('rechaza XLSX corrupto', async () => {
    await expect(parseImportFile(Buffer.from('no es un zip'), 'catalogo.xlsx')).rejects.toThrow(UnsupportedFormatError)
  })
})

describe('looksLikeCsv', () => {
  it('rechaza contenido binario', () => {
    expect(looksLikeCsv(Buffer.from([0x00, 0x01, 0x02]))).toBe(false)
    expect(looksLikeCsv(Buffer.from('a,b,c'))).toBe(true)
  })
})
