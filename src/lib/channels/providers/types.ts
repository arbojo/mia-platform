import type {
  ChannelConnection,
  ChannelType,
  NormalizedMessage,
  OutgoingMessage,
  SendResult,
  ChannelStatus,
} from '../types'

export interface ProviderHealth {
  ok: boolean
  status: ChannelStatus
  latencyMs?: number
  error?: string
}

export interface ProviderAdapter {
  readonly id: string
  readonly channel: ChannelType

  send(connection: ChannelConnection, message: OutgoingMessage): Promise<SendResult>

  receiveMessage(webhookBody: unknown): Promise<NormalizedMessage | null>

  validateWebhook(connection: ChannelConnection | null, signature: string, body: string): boolean

  ping(connection: ChannelConnection): Promise<ProviderHealth>

  connect(connection: ChannelConnection): Promise<ProviderHealth>

  disconnect(connection: ChannelConnection): Promise<ProviderHealth>

  getStatus(connection: ChannelConnection): Promise<ChannelStatus>

  verifySubscription?(params: URLSearchParams): Promise<{ valid: boolean; challenge: string | null }>
}
