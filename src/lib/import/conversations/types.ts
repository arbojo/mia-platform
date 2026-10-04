import { z } from 'zod'

/**
 * Tipos del importador de conversaciones.
 *
 * A diferencia de `import/types.ts` (catálogo de productos), este módulo
 * maneja mensajes de canal y aplica las reglas de la tabla
 * `public.channel_messages`.
 */

export const MAX_CONTENT = 20_000
export const MAX_EXTERNAL_ID = 200
export const MAX_PHONE_DIGITS = 15

/** Valores permitidos por el CHECK de `channel_messages.content_type`. */
export const CHANNEL_CONTENT_TYPES = ['text', 'image', 'audio', 'document'] as const

/** Valores permitidos por el CHECK de `channel_messages.status`. */
export const MESSAGE_STATUSES = [
  'received',
  'processing',
  'sent',
  'delivered',
  'read',
  'failed',
] as const

/**
 * Autor real del mensaje. No debe inferirse de `from_me`: un mismo número
 * puede alternar entre una persona y un bot, y ese matiz es precisamente
 * lo que hace útil el histórico para entrenar.
 */
export const AUTHOR_LABELS = ['human', 'customer', 'bot', 'bot_bug'] as const

export const authorLabelSchema = z.enum(AUTHOR_LABELS)
export type AuthorLabel = z.output<typeof authorLabelSchema>

export const directionSchema = z.enum(['incoming', 'outgoing'])
export type Direction = z.output<typeof directionSchema>

export const conversationMessageSchema = z.object({
  businessId: z.string().uuid('business_id debe ser un UUID'),
  channel: z.string().trim().min(1).max(64),
  direction: directionSchema,
  content: z
    .string()
    .trim()
    .min(1, 'El contenido no puede estar vacío')
    .max(MAX_CONTENT, `Contenido demasiado largo (máx ${MAX_CONTENT})`),
  contentType: z.enum(CHANNEL_CONTENT_TYPES).default('text'),
  externalId: z.string().trim().min(1).max(MAX_EXTERNAL_ID).nullable(),
  externalCustomerId: z
    .string()
    .trim()
    .regex(/^\d{8,15}$/, 'external_customer_id debe contener solo dígitos (8-15)')
    .nullable(),
  /**
   * El importador nunca enlaza clientes. Se fija en `null` a nivel de tipo
   * para que sea imposible pasar un customer_id por error: resolver o crear
   * clientes es responsabilidad del runtime, no de una carga histórica.
   */
  customerId: z.literal(null),
  receivedAt: z.string().datetime({ offset: true }),
  sentAt: z.string().datetime({ offset: true }).nullable(),
  status: z.enum(MESSAGE_STATUSES),
  authorLabel: authorLabelSchema.nullable().default(null),
  metadata: z.record(z.string(), z.unknown()).default({}),
})

export type ConversationMessageInput = z.input<typeof conversationMessageSchema>
export type ConversationMessage = z.output<typeof conversationMessageSchema>

export interface ConversationImportError {
  index: number
  message: string
  externalId?: string
}

export interface ConversationCounts {
  total: number
  valid: number
  invalid: number
  alreadyPresent: number
  inserted: number
  failed: number
}

export interface ConversationBreakdown {
  byDirection: Record<Direction, number>
  byAuthor: Record<string, number>
  distinctCustomers: number
  range: { from: string | null; to: string | null }
}

export interface ConversationsPreview {
  mode: 'preview'
  businessId: string
  channel: string
  counts: ConversationCounts
  breakdown: ConversationBreakdown
  errors: ConversationImportError[]
  sample: ConversationMessage[]
}

export interface ConversationsImportResult {
  mode: 'import'
  businessId: string
  channel: string
  counts: ConversationCounts
  breakdown: ConversationBreakdown
  errors: ConversationImportError[]
}

export type ConversationsResult = ConversationsPreview | ConversationsImportResult

export function emptyCounts(): ConversationCounts {
  return {
    total: 0,
    valid: 0,
    invalid: 0,
    alreadyPresent: 0,
    inserted: 0,
    failed: 0,
  }
}