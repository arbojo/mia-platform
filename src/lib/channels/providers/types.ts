import type {
  ChannelConnection,
  ChannelType,
  NormalizedMessage,
  OutgoingMessage,
  SendResult,
  ChannelStatus,
} from '../types'

export interface ProviderAdapter {
  readonly id: string
  readonly channel: ChannelType

  send(connection: ChannelConnection, message: OutgoingMessage): Promise<SendResult>

  receiveMessage(webhookBody: unknown): Promise<NormalizedMessage | null>

  validateWebhook(connection: ChannelConnection | null, signature: string, body: string): boolean

  getStatus(connection: ChannelConnection): Promise<ChannelStatus>

  verifySubscription?(params: URLSearchParams): Promise<{ valid: boolean; challenge: string | null }>
}
