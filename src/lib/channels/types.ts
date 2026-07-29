export type ChannelType = 'web' | 'whatsapp' | 'messenger' | 'instagram' | 'widget'

export type ChannelStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

export type MessageDirection = 'incoming' | 'outgoing'

export type MessageContentType = 'text' | 'image' | 'audio' | 'document'

export type MessageStatus = 'received' | 'processing' | 'sent' | 'delivered' | 'read' | 'failed'

export interface NormalizedMessage {
  channel: ChannelType
  externalId: string
  customerExternalId: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  content: string
  contentType: MessageContentType
  metadata: Record<string, unknown>
  receivedAt: Date
}

export interface OutgoingMessage {
  content: string
  contentType: MessageContentType
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
