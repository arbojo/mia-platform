export type ChannelType = 'web' | 'whatsapp' | 'messenger' | 'instagram' | 'widget'

export type ChannelStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export type MessageDirection = 'incoming' | 'outgoing'

export type MessageContentType = 'text' | 'image' | 'audio' | 'document'

export type MessageStatus = 'received' | 'processing' | 'sent' | 'delivered' | 'read' | 'failed'

export type InteractiveType = 'quick_reply' | 'list'

export type MessagePayload =
  | { type: InteractiveType; id: string; title: string }
  | { type: 'audio' }

export interface QuickReplyButton {
  id: string
  title: string
}

export interface ListRow {
  id: string
  title: string
  description?: string
}

export interface ListSection {
  title: string
  rows: ListRow[]
}

export type InteractiveComponent =
  | { type: 'quick_reply'; text: string; buttons: QuickReplyButton[] }
  | { type: 'list'; text: string; buttonText: string; sections: ListSection[] }

export interface ProductReference {
  productId: string
  name: string
  price: number | null
  imageUrl?: string | null
  description?: string | null
  benefits?: string | null
}

export interface NormalizedMessage {
  channel: ChannelType
  externalId: string
  customerExternalId: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  content: string
  contentType: MessageContentType
  payload?: MessagePayload
  metadata: Record<string, unknown>
  receivedAt: Date
}

export interface OutgoingMessage {
  content: string
  contentType: MessageContentType
  interactive?: InteractiveComponent
  metadata?: Record<string, unknown>
}

export interface SendResult {
  success: boolean
  externalId?: string
  error?: string
}

export interface ChannelConnection {
  id: string
  businessId: string
  assistantId: string
  channel: ChannelType
  status: ChannelStatus
  credentials: Record<string, unknown>
  configuration: Record<string, unknown>
  lastSync: string | null
  errorMessage: string | null
}

export interface ChannelAdapter {
  readonly channel: ChannelType

  receiveMessage(webhookBody: unknown, headers?: Record<string, string>): Promise<NormalizedMessage>

  sendMessage(connection: ChannelConnection, message: OutgoingMessage): Promise<SendResult>

  validateWebhook(signature: string, body: string): boolean

  getStatus(connection: ChannelConnection): Promise<ChannelStatus>
}

// ─── Shared MIA Core Contract (Fase 0) ──────────────────────────────────────
// These interfaces define the unified contract between Channel Adapters and the
// Shared Core. Adapters translate channel-specific I/O to CoreInput/CoreOutput.
// The Core processes business logic independent of the channel.

export interface CoreInput {
  businessId: string
  assistantId: string
  customerId?: string
  conversationId?: string
  userMessage: string
  userPayload?: MessagePayload
  channel: ChannelType | 'simulation'
  intentTag?: string | null
  landingContext?: Record<string, unknown>
  mode: 'stream' | 'complete'
  requestType: string
  preResolvedProductId?: string | null
}

export interface CoreOutput {
  response: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  textStream?: any
  product: { productId: string } | null
  media: { imageUrl: string; mediaType: 'image' | 'testimonial' } | null
  interactive?: InteractiveComponent
  metadata: {
    usedContext: Array<{ type: string; id: string }>
    conversationId?: string
    customerId?: string
    deliver: boolean
    retention?: boolean
  }
}
