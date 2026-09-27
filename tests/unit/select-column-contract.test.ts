import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

/**
 * Cada columna que el codigo pide tiene que existir en la base.
 *
 * Se puede verificar sin red porque `database.generated.ts` esta generado desde
 * el documento vivo de PostgREST, o sea que es el mismo contrato que devuelve
 * 42703 cuando una columna no existe. Los tipos todavia no estan adoptados en
 * `createAdminClient` (adopcion pendiente), pero el artefacto ya es fiel, asi
 * que el chequeo se puede hacer aqui en vez de confiar en que alguien recuerde.
 *
 * Los dos bugs mas caros de esta auditoria eran exactamente esto:
 * `conversations.business_id` y `knowledge_items.content`. Ningun test los
 * cazaba porque todos los que tocaban esas rutas mockeaban
 * `createAdminClient`, con lo que una columna mal escrita no podia fallar.
 */

const GENERATED_PATH = resolve(process.cwd(), 'src/lib/supabase/database.generated.ts')
const SRC_DIR = resolve(process.cwd(), 'src')
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx'])

type Table = { columns: Set<string>; relationships: Map<string, string> }
type Schema = Map<string, Table>
type Check = { file: string; line: number; table: string; detail: string }

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

function sliceBlocks(chunk: string, indent: number): Array<{ name: string; body: string }> {
  const re = new RegExp(`^ {${indent}}([a-z_$][\\w$]*|"[^"]+"): \\{$`, 'gm')
  const matches = [...chunk.matchAll(re)]
  return matches.map((m, i) => ({
    name: m[1].replace(/"/g, ''),
    body: chunk.slice(
      (m.index ?? 0) + m[0].length,
      i + 1 < matches.length ? (matches[i + 1].index ?? chunk.length) : chunk.length
    ),
  }))
}

/** Lee el archivo generado a esquema -> tabla -> { columnas, relaciones }. */
function parseGenerated(): Map<string, Schema> {
  const source = readFileSync(GENERATED_PATH, 'utf8')
  const body = source.slice(source.indexOf('export type Database = {'))
  const schemas = new Map<string, Schema>()

  for (const schemaBlock of sliceBlocks(body, 2)) {
    const tables: Schema = new Map()

    for (const tableBlock of sliceBlocks(schemaBlock.body, 6)) {
      const columns = new Set<string>()

      const rowStart = tableBlock.body.indexOf('Row: {')
      if (rowStart >= 0) {
        const insertStart = tableBlock.body.indexOf('Insert:', rowStart)
        const rowChunk = tableBlock.body.slice(rowStart, insertStart > 0 ? insertStart : undefined)
        for (const line of rowChunk.split('\n')) {
          const m = line.match(/^ {10}([A-Za-z_$][\w$]*|"[^"]+")\??:/)
          if (m) columns.add(m[1].replace(/"/g, ''))
        }
      }

      const relationships = new Map<string, string>()
      const relStart = tableBlock.body.indexOf('Relationships: [')
      if (relStart >= 0) {
        const re =
          /columns: \[([^\]]*)\][\s\S]*?referencedRelation: "([^"]+)"[\s\S]*?referencedColumns: \[([^\]]*)\]/g
        for (const m of tableBlock.body.slice(relStart).matchAll(re)) {
          const from = m[1]
            .split(',')
            .map((c) => c.trim().replace(/"/g, ''))
            .filter(Boolean)
          relationships.set(m[2], from[0] ?? '')
        }
      }

      tables.set(tableBlock.name, { columns, relationships })
    }

    schemas.set(schemaBlock.name, tables)
  }

  return schemas
}

type Call = { name: string | null; index: number }

/**
 * Todas las llamadas a `.metodo(`, con el literal si lo hay.
 *
 * Se registra tambien la que recibe una variable (`from(tabla)`): si esa es la
 *Dueña del select, el select no es verificable estaticamente y hay que
 * saltearlo. Ignorarla seria peor, porque el `.from(` siguiente foolaria al
 * emparejador y le atribuiria el select a la tabla anterior.
 */
function findCalls(source: string, method: string): Call[] {
  const re = new RegExp(`\\.${method}\\(\\s*(?:(['"\`])(\\w+)\\1)?`, 'g')
  return [...source.matchAll(re)].map((m) => ({ name: m[2] ?? null, index: m.index ?? 0 }))
}

/** Los selects literales: un select dinamico no se puede verificar. */
function findSelects(source: string): Call[] {
  const re = /\.select\(\s*(['"`])((?:(?!\1)[^\\])*)\1/g
  return [...source.matchAll(re)]
    .filter((m) => !m[2].includes('${'))
    .map((m) => ({ name: m[2], index: m.index ?? 0 }))
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length
}

/**
 * Parte la lista de un select por comas de primer nivel.
 *
 * Un `split(',')` a secas parte tambien dentro de los embeds: en
 * `customers(id, name, phone, memory)` separaria `name` y `phone` como si
 * fueran columnas de la tabla padre, y las reportaria como inexistentes.
 */
function splitTopLevel(list: string): string[] {
  const out: string[] = []
  let depth = 0
  let current = ''

  for (const ch of list) {
    if (ch === '(') depth++
    else if (ch === ')') depth--

    if (ch === ',' && depth === 0) {
      out.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) out.push(current)

  return out
}

type Item = { column: string } | { embed: { relation: string; columns: string[] } } | null

/** Normaliza un item de select, o null si es dinamico o no verificable. */
function normalizeItem(item: string): Item {
  if (item === '*') return null
  if (item.startsWith('...')) return null

  if (item.includes('!') || item.includes(':')) {
    const embed = item.match(/^(?:\w+:)?(\w+)!\w+\((.+)\)$/)
    if (!embed) return null
    const inner = embed[2].trim()
    // Solo embeds de una sola relacion; anidar relaciones no es verificable aqui.
    if (inner.includes('!')) return null
    const columns = splitTopLevel(inner)
      .map((c) => c.split('::')[0].trim())
      .filter((c) => /^[A-Za-z_$][\w$]*$/.test(c))
    if (columns.length === 0) return null
    return { embed: { relation: embed[1], columns } }
  }

  if (item.includes('(')) return null
  const column = item.split('::')[0].trim().replace(/^!/, '')
  if (!/^[A-Za-z_$][\w$]*$/.test(column)) return null
  return { column }
}

const schemas = parseGenerated()
const publicTables = schemas.get('public') ?? new Map()
const sourceFiles = walk(SRC_DIR).filter((f) => SOURCE_EXTENSIONS.has(f.slice(f.lastIndexOf('.'))))

const failures: Check[] = []
let pairsChecked = 0
let skippedDynamic = 0
let unknownTables = 0

for (const file of sourceFiles) {
  const source = readFileSync(file, 'utf8')
  const froms = findCalls(source, 'from')
  const selects = findSelects(source)
  const schemaCalls = findCalls(source, 'schema')
  const rel = relative(process.cwd(), file)

  for (const sel of selects) {
    // El `.from(` mas cercano por delante es el dueño. Si su tabla es dinamica
    // no se puede saber contra que esquema comparar, asi que se saltea.
    const owner = [...froms].reverse().find((f) => f.index < sel.index)
    if (!owner) continue
    if (!owner.name) {
      skippedDynamic++
      continue
    }

    // `owner` es el from mas cercano, asi que ningun `.from(` queda entre el y
    // el select: el `.schema()` anterior mas proximo es el que aplica.
    const beforeFrom = [...schemaCalls].reverse().find((s) => s.index < owner.index)
    if (beforeFrom && !beforeFrom.name) {
      skippedDynamic++
      continue
    }
    const schema = beforeFrom?.name ?? 'public'

    const table = (schema === 'public' ? publicTables : (schemas.get(schema) ?? new Map())).get(
      owner.name
    )
    if (!table) {
      unknownTables++
      continue
    }

    pairsChecked++

    for (const rawItem of splitTopLevel(sel.name!)) {
      const item = rawItem.trim()
      if (!item) continue
      const parsed = normalizeItem(item)
      if (!parsed) continue

      if ('column' in parsed) {
        if (!table.columns.has(parsed.column)) {
          failures.push({
            file: rel,
            line: lineOf(source, sel.index),
            table: owner.name,
            detail: `column '${parsed.column}' does not exist`,
          })
        }
        continue
      }

      const { relation, columns } = parsed.embed
      if (!table.relationships.has(relation)) {
        failures.push({
          file: rel,
          line: lineOf(source, sel.index),
          table: owner.name,
          detail: `no relationship '${relation}' to embed`,
        })
        continue
      }
      const referenced = publicTables.get(relation)
      if (!referenced) continue
      for (const column of columns) {
        if (!referenced.columns.has(column)) {
          failures.push({
            file: rel,
            line: lineOf(source, sel.index),
            table: owner.name,
            detail: `${relation}.${column} does not exist`,
          })
        }
      }
    }
  }
}

describe('selected columns exist in the real schema', () => {
  it('parsed the generated types into a usable shape', () => {
    expect(publicTables.size).toBeGreaterThan(40)
    expect(publicTables.get('conversations')?.columns.has('assistant_id')).toBe(true)
    expect(publicTables.get('knowledge_items')?.columns.has('question')).toBe(true)
    expect(publicTables.get('conversations')?.columns.has('business_id')).toBe(false)
  })

  it('actually inspected a meaningful number of selects', () => {
    // Si esto baja, el guard se esta quedando mudo: un chequeo que no mira nada
    // pasa siempre y no vale como red.
    expect(pairsChecked).toBeGreaterThan(200)
  })

  it('reports its own coverage gaps so a silent guard is visible', () => {
    // Estos dos contadores son lo que impide que el guard se apague en silencio:
    // un `.from()` dinamico o una tabla que no esta en los tipos generados
    // quedan fuera de la verificacion, y hay que saber cuantos son.
    expect(skippedDynamic + unknownTables).toBeLessThan(pairsChecked)
  })

  it('every selected column and embed resolves against the schema', () => {
    const report = failures
      .map((f) => `${f.file}:${f.line} ${f.table} -> ${f.detail}`)
      .sort()
    // La cobertura del scan va en el mensaje: asi un fallo indica tambien
    // cuanto se dejo sin verificar.
    const coverage = `scanned ${pairsChecked} selects (${skippedDynamic} dynamic, ${unknownTables} unknown table) skipped`
    expect(report, coverage).toEqual([])
  })
})
