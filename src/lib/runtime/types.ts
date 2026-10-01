import type { MessagePayload } from '@/lib/channels/types'

export interface WireMessage {
  channel: string
  externalId: string
  customerExternalId: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  content: string
  contentType: 'text' | 'image' | 'audio' | 'document'
  payload?: MessagePayload
  metadata: Record<string, unknown>
  receivedAt: Date
  /**
   * Set when the channel positively identified the author as a business-side
   * human (today: the Baileys bridge, which matches its own sent-message ids to
   * disambiguate `fromMe`). Persisted for learning, never auto-answered.
   */
  fromHuman?: boolean
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
