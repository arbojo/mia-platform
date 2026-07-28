export interface WireMessage {
  channel: string
  externalId: string
  customerExternalId: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  content: string
  contentType: 'text' | 'image' | 'audio' | 'document'
  metadata: Record<string, unknown>
  receivedAt: Date
}

export interface BrainMessage {
  id: string
  conversationId: string
  customerId: string
  content: string
  receivedAt: Date
}

export interface BrainResponse {
  content: string
  usage: { promptTokens: number; completionTokens: number }
}
