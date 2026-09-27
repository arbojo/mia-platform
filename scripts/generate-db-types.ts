/**
 * Generates `src/lib/supabase/database.generated.ts` from the live schema.
 *
 * Why this exists: the hand-written `Database` type in src/lib/types covered 24
 * tables while the database has 42 in public plus the delivery and inventory
 * schemas, and the admin client was created without a generic at all. So
 * `supabase.from('conversations').eq('business_id', id)` compiled fine and only
 * failed at runtime with Postgres 42703, in scheduled jobs nobody was watching.
 * Generating the type from the schema the queries actually run against turns
 * that class of bug into a compile error.
 *
 * Sources, and why each one:
 *   - `public`: the PostgREST OpenAPI document at /rest/v1/. This is the same
 *     document that rejects a bad column, so the type cannot drift from it.
 *   - `delivery` / `inventory`: PostgREST serves these but omits them from the
 *     OpenAPI document, so their shape comes from the migrations and every table
 *     is verified against the running database column by column.
 *   - `analytics`: created by a migration but not exposed by PostgREST, so it is
 *     reported and skipped rather than typed against something unreachable.
 *
 * Usage: npx tsx scripts/generate-db-types.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

type OpenApiProperty = {
  type?: string
  format?: string
  items?: { type?: string; format?: string; enum?: unknown[] }
  enum?: unknown[]
  default?: unknown
  description?: string
}

type OpenApiSchema = {
  required?: string[]
  properties?: Record<string, OpenApiProperty>
}

type OpenApiSpec = {
  components?: { schemas?: Record<string, OpenApiSchema> }
  definitions?: Record<string, OpenApiSchema>
}

const OUT = resolve(process.cwd(), 'src/lib/supabase/database.generated.ts')
const MIGRATIONS_DIR = resolve(process.cwd(), 'supabase/migrations')

/** The repo keeps its secrets in .env.local, which dotenv does not read. */
function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {}
  const text = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  for (const line of text.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (match) out[match[1]] = match[2].trim()
  }
  return out
}

function tsType(property: OpenApiProperty): string {
  if (property.enum?.length) {
    return property.enum.map((v) => JSON.stringify(v)).join(' | ')
  }

  if (property.type === 'array' || property.format?.endsWith('[]')) {
    const itemFormat = property.format?.replace('[]', '')
    const item = itemFormat && itemFormat !== property.format ? { format: itemFormat } : (property.items ?? {})
    return `${tsType(item)}[]`
  }

  switch (property.format) {
    case 'uuid':
    case 'character varying':
    case 'text':
    case 'timestamp with time zone':
    case 'timestamp without time zone':
    case 'date':
    case 'time with time zone':
    case 'time without time zone':
    case 'interval':
    case 'citext':
    case 'inet':
    case 'cidr':
    case 'macaddr':
    case 'macaddr8':
    case 'ltree':
    case 'ltree[]':
      return 'string'
    case 'numeric':
    case 'decimal':
    case 'double precision':
    case 'real':
    case 'integer':
    case 'bigint':
    case 'smallint':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'jsonb':
    case 'json':
      return 'Json'
    case 'uuid[]':
      return 'string[]'
    case 'integer[]':
    case 'bigint[]':
    case 'numeric[]':
      return 'number[]'
    case 'text[]':
    case 'character varying[]':
      return 'string[]'
    default:
      break
  }

  switch (property.type) {
    case 'string':
      return 'string'
    case 'number':
    case 'integer':
      return 'number'
    case 'boolean':
      return 'boolean'
    default:
      return 'Json'
  }
}

/** Postgres type token -> TypeScript, for the migration-sourced schemas. */
function pgTypeToTs(rawType: string): string {
  const base = rawType.replace(/\(.*\)/, '').replace(/\[\]$/, '').trim().toUpperCase()
  switch (base) {
    case 'SERIAL':
    case 'BIGSERIAL':
    case 'SMALLSERIAL':
    case 'INT':
    case 'INT2':
    case 'INT4':
    case 'INT8':
    case 'FLOAT4':
    case 'FLOAT8':
    case 'DOUBLE':
    case 'DOUBLE PRECISION':
    case 'MONEY':
    case 'NUMERIC':
    case 'DECIMAL':
    case 'REAL':
    case 'INTEGER':
    case 'BIGINT':
    case 'SMALLINT':
      return 'number'
    case 'BOOL':
    case 'BOOLEAN':
      return 'boolean'
    case 'UUID':
    case 'TEXT':
    case 'CHARACTER':
    case 'CHARACTER VARYING':
    case 'VARCHAR':
    case 'BPCHAR':
    case 'CITEXT':
    case 'INET':
    case 'CIDR':
    case 'MACADDR':
    case 'TIMESTAMPTZ':
    case 'TIMESTAMP':
    case 'TIMESTAMP WITH TIME ZONE':
    case 'TIMESTAMP WITHOUT TIME ZONE':
    case 'TIME':
    case 'TIME WITH TIME ZONE':
    case 'TIME WITHOUT TIME ZONE':
    case 'DATE':
    case 'INTERVAL':
      return 'string'
    case 'JSON':
    case 'JSONB':
      return 'Json'
    default:
      // `tsType` is written against the OpenAPI spec, where Postgres formats
      // arrive lowercased ("uuid", "character varying"). Passing the uppercased
      // token straight through silently produced Json for every column.
      return tsType({ format: base.toLowerCase() })
  }
}

/** A key is a reserved word only in the sense that it needs no quoting. */
function safeKey(name: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name)
}

type Field = { optional: boolean; type: string }

/**
 * OpenApi property -> typed field, as a [name, field] tuple. Returns tuples
 * because the OpenAPI property also has a `type` key, and reading that instead
 * of the computed TS type silently renders `array` for every array column.
 */
function toFields(schema: OpenApiSchema): Array<[string, Field]> {
  const required = new Set(schema.required ?? [])
  return Object.entries(schema.properties ?? {}).map(([name, property]) => [
    name,
    {
      // Not-null in Postgres means present and non-null on read.
      optional: !required.has(name),
      type: tsType(property),
    },
  ])
}

function renderFields(
  fields: Array<[string, Field]>,
  indent: string,
  { forceOptional }: { forceOptional: boolean }
): string {
  return fields
    .map(([name, field]) => {
      const optional = forceOptional || field.optional
      return `${indent}${safeKey(name)}${optional ? '?' : ''}: ${field.type}${field.optional ? ' | null' : ''}`
    })
    .join('\n')
}

type Relationship = {
  foreignKeyName: string
  columns: string[]
  isOneToOne: boolean
  referencedRelation: string
  referencedColumns: string[]
}

/**
 * PostgREST records foreign keys only in the column description, e.g.
 * "Note:\nThis is a Foreign Key to `assistants.id`.<fk table='assistants' column='id'/>".
 * Emitting them matters: without Relationships, supabase-js types every
 * `!inner(embed)` as `never` and the real signal ("column does not exist") gets
 * buried under false positives.
 */
function toRelationships(table: string, schema: OpenApiSchema): Relationship[] {
  const out: Relationship[] = []

  for (const [column, property] of Object.entries(schema.properties ?? {})) {
    const match = property.description?.match(/<fk table='([^']+)' column='([^']+)'\/>/)
    if (!match) continue

    const [, referencedRelation, referencedColumn] = match
    const isOneToOne = schema.required?.includes(column) === true && !column.endsWith('_id')

    out.push({
      // PostgREST does not expose the constraint name. Postgres' default
      // convention is what `supabase gen types` emits too.
      foreignKeyName: `${table}_${column}_fkey`,
      columns: [column],
      isOneToOne,
      referencedRelation,
      referencedColumns: [referencedColumn],
    })
  }

  return out
}

function renderRelationships(relationships: Relationship[]): string {
  if (relationships.length === 0) return '        Relationships: []'
  return `        Relationships: [
${relationships
    .map(
      (r) => `          {
            foreignKeyName: ${JSON.stringify(r.foreignKeyName)}
            columns: [${r.columns.map((c) => JSON.stringify(c)).join(', ')}]
            isOneToOne: ${r.isOneToOne}
            referencedRelation: ${JSON.stringify(r.referencedRelation)}
            referencedColumns: [${r.referencedColumns.map((c) => JSON.stringify(c)).join(', ')}]
          }`
    )
    .join(',\n')}
        ]`
}

type MigrationColumn = {
  name: string
  type: string
  notNull: boolean
  hasDefault: boolean
  references?: { table: string; column: string }
}

type MigrationTable = {
  schema: string
  name: string
  columns: MigrationColumn[]
}

const TYPE_TOKEN =
  '(?:DOUBLE PRECISION|CHARACTER VARYING|TIMESTAMP WITH TIME ZONE|TIMESTAMP WITHOUT TIME ZONE|TIME WITH TIME ZONE|TIME WITHOUT TIME ZONE|[A-Za-z][A-Za-z0-9_]*)(?:\\s*\\([^)]*\\))?(?:\\[\\])?'

/**
 * Reads the shape of the non-public schemas out of the migrations.
 *
 * PostgREST serves `delivery` and `inventory` but documents neither, and the
 * migrations are the only in-repo record of their shape. Every table found here
 * is then checked against the running database.
 */
function readMigrationTables(): MigrationTable[] {
  const tables: MigrationTable[] = []
  const byKey = new Map<string, MigrationTable>()
  const warnings: string[] = []

  const addColumn = (table: MigrationTable, name: string, rawType: string, rest: string) => {
    if (table.columns.some((c) => c.name === name)) return
    const references = rest.match(/REFERENCES\s+(?:\w+\.)?(\w+)\s*\(\s*(\w+)\s*\)/i)
    table.columns.push({
      name,
      type: pgTypeToTs(rawType),
      notNull: /\bNOT NULL\b/i.test(rest),
      hasDefault: /\bDEFAULT\b/i.test(rest),
      references: references ? { table: references[1], column: references[2] } : undefined,
    })
  }

  const applyAlter = (schema: string, name: string, text: string) => {
    const table = byKey.get(`${schema}.${name}`)
    if (!table) {
      // `public` is typed from the OpenAPI document, so a CREATE TABLE this
      // parser did not match there is not a gap worth reporting.
      if (schema !== 'public') {
        warnings.push(`ALTER TABLE ${schema}.${name} has no CREATE TABLE in the migrations`)
      }
      return
    }

    const added = new RegExp(
      `ADD\\s+COLUMN\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?([a-z_][a-z0-9_]*)\\s+(${TYPE_TOKEN})\\s*([^,;]*)`,
      'gi'
    )
    for (const match of text.matchAll(added)) addColumn(table, match[1], match[2], match[3])

    for (const match of text.matchAll(/DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?([a-z_][a-z0-9_]*)/gi)) {
      const index = table.columns.findIndex((c) => c.name === match[1])
      if (index >= 0) table.columns.splice(index, 1)
    }
  }

  for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'))) {
    // Migrations are CRLF on Windows. In JavaScript `.` does not match `\r` and
    // `$` does not match before it, so every column line would silently fail to
    // parse and the table would render with no columns at all.
    const lines = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8').split(/\r?\n/)

    let current: MigrationTable | null = null
    let alter: { schema: string; name: string; text: string } | null = null

    for (const line of lines) {
      if (alter) {
        alter.text += ` ${line}`
        if (line.includes(';')) {
          applyAlter(alter.schema, alter.name, alter.text)
          alter = null
        }
        continue
      }

      if (!current) {
        const openAlter = line.match(/^\s*ALTER TABLE\s+(?:IF EXISTS\s+)?(\w+)\.(\w+)\b(.*)$/i)
        if (openAlter) {
          const [, schema, name, rest] = openAlter
          if (rest.includes(';')) applyAlter(schema, name, rest)
          else alter = { schema, name, text: rest }
          continue
        }

        const open = line.match(/^\s*CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(\w+)\.(\w+)\s*\(\s*$/i)
        if (open) {
          current = { schema: open[1], name: open[2], columns: [] }
          byKey.set(`${current.schema}.${current.name}`, current)
        }
        continue
      }

      if (/^\s*\)\s*;?\s*$/.test(line)) {
        tables.push(current)
        current = null
        continue
      }

      // Table-level constraints are not columns.
      if (/^\s*(CONSTRAINT|CHECK|PRIMARY|UNIQUE|FOREIGN|EXCLUDE|LIKE)\b/i.test(line)) continue

      // The type is a single token (plus any length/array suffix). Capturing it
      // greedily would swallow `NOT NULL DEFAULT gen_random_uuid()` and produce a
      // type that matches nothing.
      const column = line.match(
        new RegExp(`^\\s*([a-z_][a-z0-9_]*)\\s+(${TYPE_TOKEN})\\s*(.*)$`, 'i')
      )
      if (!column) continue

      addColumn(current, column[1], column[2], column[3])
    }

    if (current) tables.push(current)
  }

  for (const warning of warnings) console.warn(`  warning: ${warning}`)

  return tables
}

/**
 * Live column list for a non-public table, via PostgREST's Accept-Profile.
 *
 * Note that a schema-qualified table name in `from()` does not work: PostgREST
 * answers `/rest/v1/inventory.assets` with PGRST205. The schema has to travel in
 * the profile header, which is what `.schema('inventory').from('assets')` does.
 */
async function probeLiveColumns(
  url: string,
  key: string,
  schema: string,
  table: string
): Promise<{ kind: 'missing' } | { kind: 'unexposed' } | { kind: 'ok'; columns: string[] }> {
  const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Accept-Profile': schema },
  })

  if (response.status === 404) return { kind: 'missing' }
  if (response.status === 406) return { kind: 'unexposed' }
  if (!response.ok) {
    throw new Error(`${schema}.${table}: ${response.status} ${await response.text()}`)
  }

  const rows = (await response.json()) as Array<Record<string, unknown>>
  const first = rows[0]
  // An empty table proves it exists but reveals no columns.
  return { kind: 'ok', columns: first ? Object.keys(first) : [] }
}

function renderDomainTable(
  table: MigrationTable,
  live: string[],
  sameSchemaTables: Set<string>
): string {
  const declared = new Set(table.columns.map((c) => c.name))

  const missingLive = table.columns.filter((c) => live.length > 0 && !live.includes(c.name))
  if (missingLive.length > 0) {
    throw new Error(
      `${table.schema}.${table.name}: migrations declare ${missingLive
        .map((c) => c.name)
        .join(', ')} but the live table does not have them`
    )
  }

  // A column present live but absent from the migrations is a hole in the DDL
  // record, not a reason to emit "column does not exist" against working code.
  // Adding it as Json keeps the type honest about existing and only loses
  // precision; the comment names it so the gap gets noticed.
  const undeclared = live.filter((c) => !declared.has(c))

  const fields: Array<[string, Field]> = [
    ...table.columns.map((c) => [c.name, { optional: !c.notNull, type: c.type }] as [string, Field]),
    ...undeclared.map((c) => [c, { optional: true, type: 'Json' }] as [string, Field]),
  ]

  // A NOT NULL column with a database default may be omitted on insert.
  const insertFields: Array<[string, Field]> = table.columns.map((c) => [
    c.name,
    { optional: !c.notNull || c.hasDefault, type: c.type },
  ])

  const relationships: Relationship[] = []
  for (const column of table.columns) {
    if (!column.references) continue
    // PostgREST cannot embed across schemas, and a self reference is not
    // something this project embeds.
    if (column.references.table === table.name) continue
    if (!sameSchemaTables.has(column.references.table)) continue
    relationships.push({
      foreignKeyName: `${table.schema}_${table.name}_${column.name}_fkey`,
      columns: [column.name],
      isOneToOne: column.notNull && !column.name.endsWith('_id'),
      referencedRelation: column.references.table,
      referencedColumns: [column.references.column],
    })
  }

  const row = renderFields(fields, ' '.repeat(10), { forceOptional: false })
  const insert = renderFields(insertFields, ' '.repeat(10), { forceOptional: false })
  const update = renderFields(fields, ' '.repeat(10), { forceOptional: true })

  const note = undeclared.length
    ? `\n// Live columns absent from the migrations: ${undeclared.join(', ')}`
    : ''

  return `      ${safeKey(table.name)}: {
        Row: {
${row}
        }
        Insert: {
${insert}
        }
        Update: {
${update}
        }
${renderRelationships(relationships)}
      }${note}`
}

function renderTable(name: string, schema: OpenApiSchema): string {
  const required = new Set(schema.required ?? [])
  const entries = Object.entries(schema.properties ?? {})
  const fields = toFields(schema)

  const row = renderFields(fields, ' '.repeat(10), { forceOptional: false })

  // Insert: a column with a database default may be omitted, so only NOT NULL
  // columns without a default are truly required from the caller.
  const insert = entries
    .map(([column, property]) => {
      const mustProvide = required.has(column) && property.default === undefined
      const nullable = !required.has(column)
      const type = nullable ? `${tsType(property)} | null` : tsType(property)
      return `${' '.repeat(10)}${safeKey(column)}${mustProvide ? '' : '?'}: ${type}`
    })
    .join('\n')

  const update = renderFields(fields, ' '.repeat(10), { forceOptional: true })

  return `      ${safeKey(name)}: {
        Row: {
${row}
        }
        Insert: {
${insert}
        }
        Update: {
${update}
        }
${renderRelationships(toRelationships(name, schema))}
      }`
}

async function main() {
  const env = loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }

  const response = await fetch(`${url}/rest/v1/`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/openapi+json',
    },
  })

  if (!response.ok) {
    throw new Error(`PostgREST schema request failed: ${response.status} ${await response.text()}`)
  }

  const spec = (await response.json()) as OpenApiSpec
  const schemas = spec.components?.schemas ?? spec.definitions ?? {}

  // PostgREST exposes RPCs as schemas too; they are not tables.
  const tableNames = Object.keys(schemas)
    .filter((name) => name !== 'Timestamp' && !name.startsWith('_'))
    .sort()

  const tables = tableNames.map((name) => renderTable(name, schemas[name])).join('\n')

  const domainSchemas = new Map<string, MigrationTable[]>()
  for (const table of readMigrationTables()) {
    if (table.schema === 'public') continue
    const list = domainSchemas.get(table.schema) ?? []
    list.push(table)
    domainSchemas.set(table.schema, list)
  }

  const domainBlocks: string[] = []
  const warnings: string[] = []

  for (const [schemaName, schemaTables] of [...domainSchemas.entries()].sort()) {
    // Probe first, render second: a relationship may point at a table that sorts
    // after this one, so the full set has to be known before any table renders.
    const probed: Array<{ table: MigrationTable; live: string[] }> = []

    for (const table of [...schemaTables].sort((a, b) => a.name.localeCompare(b.name))) {
      const result = await probeLiveColumns(url, key, schemaName, table.name)
      if (result.kind === 'unexposed') {
        warnings.push(`${schemaName} is not exposed by PostgREST; not typed`)
        break
      }
      if (result.kind === 'missing') {
        warnings.push(
          `${schemaName}.${table.name} is in the migrations but not in the database; skipped`
        )
        continue
      }
      probed.push({ table, live: result.columns })
    }

    if (probed.length === 0) continue

    const liveTables = new Set(probed.map((p) => p.table.name))
    const rendered = probed.map((p) => renderDomainTable(p.table, p.live, liveTables))

    domainBlocks.push(`  ${schemaName}: {
    Tables: {
${rendered.join('\n')}
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }`)
  }

  const file = `// AUTO-GENERATED by scripts/generate-db-types.ts. Do not edit by hand.
//
// Source: the live PostgREST OpenAPI document at /rest/v1/ for the connected
// Supabase project, plus the migrations for the schemas PostgREST does not
// document. Regenerate with: npm run db:types
//
// Do not widen these types by hand to make an error go away. That reintroduces
// exactly the drift this file exists to prevent: a column that the type
// claims exists but the database does not is a runtime 42703 waiting to happen
// in a scheduled job nobody is watching.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
${tables}
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }${domainBlocks.length ? `\n${domainBlocks.join('\n')}` : ''}
}
`

  writeFileSync(OUT, file, 'utf8')
  console.log(`Wrote ${OUT}`)
  console.log(`Tables: ${tableNames.length} in public`)
  console.log(
    `Schemas: ${[...domainSchemas.keys()].sort().join(', ') || 'none'}${
      warnings.length ? `\nWarnings:\n  ${warnings.join('\n  ')}` : ''
    }`
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
