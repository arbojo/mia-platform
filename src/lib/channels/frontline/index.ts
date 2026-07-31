import { getProvider } from '@/lib/channels/providers'
import { getAdapter } from '@/lib/channels/gateway'
import type {
  ChannelConnection,
  ChannelType,
  NormalizedMessage,
  OutgoingMessage,
  SendResult,
  ChannelStatus,
} from '@/lib/channels/types'

function firstPartyConnection(channel: ChannelType): ChannelConnection {
  return {
    id: '',
    businessId: '',
    assistantId: '',
    channel,
    status: 'connected',
    credentials: {},
    configuration: {},
    lastSync: null,
    errorMessage: null,
  }
}

export async function send(
  channel: ChannelType,
  connection: ChannelConnection | null,
  message: OutgoingMessage
): Promise<SendResult> {
  const provider = getProvider(channel)

  if (provider) {
    if (!connection) {
      return { success: false, error: `No connection for channel ${channel}` }
    }
    return provider.send(connection, message)
  }

  return getAdapter(channel).sendMessage(firstPartyConnection(channel), message)
}

export async function receive(
  channel: ChannelType,
  webhookBody: unknown
): Promise<NormalizedMessage | null> {
  const provider = getProvider(channel)

  if (provider) {
    return provider.receiveMessage(webhookBody)
  }

  return getAdapter(channel).receiveMessage(webhookBody)
}

export function validateWebhook(
  channel: ChannelType,
  connection: ChannelConnection | null,
  signature: string,
  body: string
): boolean {
  const provider = getProvider(channel)

  if (provider) {
    return provider.validateWebhook(connection, signature, body)
  }

  return getAdapter(channel).validateWebhook(signature, body)
}

export async function getStatus(
  channel: ChannelType,
  connection: ChannelConnection | null
): Promise<ChannelStatus> {
  const provider = getProvider(channel)

  if (provider) {
    if (!connection) {
      return 'disconnected'
    }
    return provider.getStatus(connection)
  }

  return getAdapter(channel).getStatus(firstPartyConnection(channel))
}

export async function verifySubscription(
  channel: ChannelType,
  params: URLSearchParams
): Promise<{ valid: boolean; challenge: string | null }> {
  const provider = getProvider(channel)

  if (provider?.verifySubscription) {
    return provider.verifySubscription(params)
  }

  return { valid: false, challenge: null }
}
