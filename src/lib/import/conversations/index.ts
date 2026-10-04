import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ConversationBreakdown,
  ConversationImportError,
  ConversationMessage,
  ConversationsImportResult,
  ConversationsPreview,
  Direction,
} from './types'
import { conversationMessageSchema, emptyCounts } from './types'

export const DEFAULT_BATCH_SIZE = 200
/**
 * Tope del cuerpo de la URL para `.in(...)`. PostgREST recibe los filtros en
 * el query string, así que un lote grande agota el límite de cabeceras del
 * servidor (~16 KB) y falla con UND_ERR_HEADERS_OVERFLOW.
 */
const MAX_FILTER_QUERY_CHARS = 3_000
const DEFAULT_SAMPLE_SIZE = 10

export interface ConversationsInput {
  messages: unknown[]
  businessId: string
  channel: string
  admin: SupabaseClient
}

/** Fila tal y como se envia a Postgres. */
interface ChannelMessageRow {
  business_id: string
  channel: string
  direction: Direction
  content: string
  content_type: string
  external_id: string | null
  external_customer_id: string | null
  customer_id: null
  metadata: Record<string, unknown>
  status: string
  received_at: string
  sent_at: string | null
}

function toRow(message: ConversationMessage): ChannelMessageRow {
  return {
    business_id: message.businessId,
    channel: message.channel,
    direction: message.direction,
    content: message.content,
    content_type: message.contentType,
    external_id: message.externalId,
    external_customer_id: message.externalCustomerId,
    // Nunca se enlaza un customer al importar histórico.
    customer_id: null,
    metadata: message.authorLabel
      ? { ...message.metadata, author_label: message.authorLabel }
      : message.metadata,
    status: message.status,
    received_at: message.receivedAt,
    sent_at: message.sentAt,
  }
}

function validate(messages: unknown[]): {
  valid: ConversationMessage[]
  errors: ConversationImportError[]
} {
  const valid: ConversationMessage[] = []
  const errors: ConversationImportError[] = []

  messages.forEach((candidate, index) => {
    const parsed = conversationMessageSchema.safeParse(candidate)
    if (parsed.success) {
      valid.push(parsed.data)
      return
    }
    const first = parsed.error.issues[0]
    errors.push({
      index,
      message: first ? `${first.path.join('.') || 'mensaje'}: ${first.message}` : 'Mensaje inválido',
      externalId:
        typeof candidate === 'object' && candidate !== null && 'externalId' in candidate
          ? String((candidate as Record<string, unknown>).externalId)
          : undefined,
    })
  })

  return { valid, errors }
}

/** Agrupa ids en lotes cuya URL aproximada no exceda el limite seguro. */
function chunkExternalIds(ids: string[]): string[][] {
  const chunks: string[][] = []
  let current: string[] = []
  let size = 0

  for (const id of ids) {
    const cost = id.length + 3 // id + separadores %2C
    if (current.length > 0 && size + cost > MAX_FILTER_QUERY_CHARS) {
      chunks.push(current)
      current = []
      size = 0
    }
    current.push(id)
    size += cost
  }
  if (current.length > 0) chunks.push(current)
  return chunks
}

async function fetchExistingExternalIds(
  admin: SupabaseClient,
  businessId: string,
  channel: string,
  ids: string[]
): Promise<Set<string>> {
  const found = new Set<string>()
  for (const chunk of chunkExternalIds(ids)) {
    const { data, error } = await admin
      .from('channel_messages')
      .select('external_id')
      .eq('business_id', businessId)
      .eq('channel', channel)
      .in('external_id', chunk)

    if (error) throw error
    for (const row of (data ?? []) as Array<{ external_id: string | null }>) {
      if (row.external_id) found.add(row.external_id)
    }
  }
  return found
}

function buildBreakdown(messages: ConversationMessage[]): ConversationBreakdown {
  const byDirection: Record<Direction, number> = { incoming: 0, outgoing: 0 }
  const byAuthor: Record<string, number> = {}
  const customers = new Set<string>()
  let from: string | null = null
  let to: string | null = null

  for (const message of messages) {
    byDirection[message.direction] += 1

    const author = message.direction === 'incoming' ? 'customer' : message.authorLabel ?? 'human'
    byAuthor[author] = (byAuthor[author] ?? 0) + 1

    if (message.externalCustomerId) customers.add(message.externalCustomerId)
    if (from === null || message.receivedAt < from) from = message.receivedAt
    if (to === null || message.receivedAt > to) to = message.receivedAt
  }

  return { byDirection, byAuthor, distinctCustomers: customers.size, range: { from, to } }
}

/**
 * Valida y resume sin escribir nada en la base de datos.
 * `sampleSize` acota cuántos mensajes se devuelven para inspección.
 */
export async function previewConversations(
  input: ConversationsInput & { sampleSize?: number }
): Promise<ConversationsPreview> {
  const { valid, errors } = validate(input.messages)
  const counts = emptyCounts()
  counts.total = input.messages.length
  counts.valid = valid.length
  counts.invalid = errors.length

  const externalIds = valid.map((m) => m.externalId).filter((id): id is string => id !== null)
  let pending = valid

  if (externalIds.length > 0) {
    const existing = await fetchExistingExternalIds(
      input.admin,
      input.businessId,
      input.channel,
      externalIds
    )
    pending = valid.filter((m) => m.externalId === null || !existing.has(m.externalId))
    counts.alreadyPresent = valid.length - pending.length
  }

  return {
    mode: 'preview',
    businessId: input.businessId,
    channel: input.channel,
    counts,
    breakdown: buildBreakdown(pending),
    errors,
    sample: pending.slice(0, input.sampleSize ?? DEFAULT_SAMPLE_SIZE),
  }
}

/**
 * Inserta el histórico en lotes. Los mensajes ya presentes se omiten, de modo
 * que reejecutar la carga es seguro. Nunca escribe en `customers`.
 */
export async function importConversations(
  input: ConversationsInput & { batchSize?: number }
): Promise<ConversationsImportResult> {
  const { valid, errors } = validate(input.messages)
  const counts = emptyCounts()
  counts.total = input.messages.length
  counts.valid = valid.length
  counts.invalid = errors.length

  const externalIds = valid.map((m) => m.externalId).filter((id): id is string => id !== null)
  let pending = valid

  if (externalIds.length > 0) {
    const existing = await fetchExistingExternalIds(
      input.admin,
      input.businessId,
      input.channel,
      externalIds
    )
    pending = valid.filter((m) => m.externalId === null || !existing.has(m.externalId))
    counts.alreadyPresent = valid.length - pending.length
  }

  const batchSize = input.batchSize ?? DEFAULT_BATCH_SIZE
  const allErrors = [...errors]

  for (let i = 0; i < pending.length; i += batchSize) {
    const batch = pending.slice(i, i + batchSize)
    const rows = batch.map(toRow)

    const { error } = await input.admin.from('channel_messages').insert(rows)

    if (!error) {
      counts.inserted += rows.length
      continue
    }

    // Un lote puede fallar por una sola fila conflictiva: reintentamos
    // individually para identificarla sin perder el resto del lote.
    for (const [offset, row] of rows.entries()) {
      const { error: singleError } = await input.admin
        .from('channel_messages')
        .insert([row])

      const index = i + offset
      if (singleError) {
        counts.failed += 1
        allErrors.push({
          index,
          message: singleError.message,
          externalId: pending[index]?.externalId ?? undefined,
        })
      } else {
        counts.inserted += 1
      }
    }
  }

  return {
    mode: 'import',
    businessId: input.businessId,
    channel: input.channel,
    counts,
    breakdown: buildBreakdown(pending),
    errors: allErrors,
  }
}