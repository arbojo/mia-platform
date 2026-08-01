import { getProvider } from '@/lib/channels/providers'
import { getAdapter } from '@/lib/channels/gateway'
import { eventBus } from '@/lib/channels/frontline'
import { dependencyRegistry } from '@/lib/channels/frontline'
import { FrontlineEventCatalog } from '@/lib/channels/frontline'
import type { ProviderHealth } from '@/lib/channels/providers/types'
import type {
  ChannelConnection,
  ChannelType,
  NormalizedMessage,
  OutgoingMessage,
  SendResult,
  ChannelStatus,
} from '@/lib/channels/types'
import type { FrontlineEvent, SignalSeverity } from '@/lib/channels/frontline'

/**
 * Transport Router — the pilots.
 *
 * It selects the active provider, performs health checks, connects and
 * disconnects, and carries messages. It NEVER analyzes, NEVER decides and
 * NEVER consults external feeds. Its only output beyond transport is a stream
 * of observations published to the Frontline event bus (the control tower)
 * using the generic `dominio.acción` vocabulary.
 *
 * This module belongs to the channels domain and depends on Frontline —
 * never the other way around. Frontline does not know what a channel is.
 */

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

function dependencyIdFor(channel: ChannelType): string | null {
  const provider = getProvider(channel)
  if (!provider) return null
  return dependencyRegistry.getByLink('transport', provider.id)?.id ?? provider.id
}

function publish(
  channel: ChannelType,
  kind: string,
  payload?: FrontlineEvent['payload'],
  severity?: SignalSeverity
): void {
  const dependencyId = dependencyIdFor(channel)
  if (!dependencyId) return
  void eventBus.publish({ dependencyId, source: 'router', kind, severity, occurredAt: new Date(), payload })
}

const lastHealthByChannel = new Map<ChannelType, ChannelStatus>()
const lastProviderByChannel = new Map<ChannelType, string>()

function noteProvider(channel: ChannelType, providerId: string | null): void {
  const previous = lastProviderByChannel.get(channel)
  if (providerId && previous !== providerId) {
    lastProviderByChannel.set(channel, providerId)
    publish(channel, FrontlineEventCatalog.transportChanged, {
      channel,
      previous: previous ?? null,
      current: providerId,
    })
  } else if (!providerId) {
    lastProviderByChannel.delete(channel)
    publish(channel, FrontlineEventCatalog.transportChanged, {
      channel,
      previous: previous ?? null,
      current: null,
    })
  }
}

function noteHealth(channel: ChannelType, health: ProviderHealth): void {
  const previous = lastHealthByChannel.get(channel)
  if (previous === health.status) return

  lastHealthByChannel.set(channel, health.status)
  publish(channel, FrontlineEventCatalog.dependencyHealth, {
    channel,
    ok: health.ok,
    status: health.status,
    latencyMs: health.latencyMs,
    error: health.error,
  })
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
    const result = await provider.send(connection, message)
    if (!result.success) {
      publish(channel, FrontlineEventCatalog.deliveryFailed, {
        channel,
        provider: provider.id,
        error: result.error,
      }, 'warning')
    }
    return result
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

export async function ping(
  channel: ChannelType,
  connection: ChannelConnection | null
): Promise<ProviderHealth> {
  const provider = getProvider(channel)

  if (provider) {
    if (!connection) {
      return { ok: false, status: 'error', error: `No connection for channel ${channel}` }
    }
    const health = await provider.ping(connection)
    noteProvider(channel, health.ok ? provider.id : null)
    noteHealth(channel, health)
    return health
  }

  return { ok: true, status: 'connected' }
}

export async function connect(
  channel: ChannelType,
  connection: ChannelConnection | null
): Promise<ProviderHealth> {
  const provider = getProvider(channel)

  if (provider) {
    if (!connection) {
      return { ok: false, status: 'error', error: `No connection for channel ${channel}` }
    }
    const health = await provider.connect(connection)
    noteProvider(channel, health.ok ? provider.id : null)
    noteHealth(channel, health)
    if (health.ok) {
      publish(channel, FrontlineEventCatalog.dependencyHealthy, {
        channel,
        provider: provider.id,
        latencyMs: health.latencyMs,
      })
    } else {
      publish(channel, FrontlineEventCatalog.dependencyDown, {
        channel,
        provider: provider.id,
        error: health.error,
      }, 'critical')
    }
    return health
  }

  return { ok: true, status: 'connected' }
}

export async function disconnect(
  channel: ChannelType,
  connection: ChannelConnection | null
): Promise<ProviderHealth> {
  const provider = getProvider(channel)

  if (provider) {
    if (!connection) {
      return { ok: false, status: 'error', error: `No connection for channel ${channel}` }
    }
    const health = await provider.disconnect(connection)
    noteProvider(channel, null)
    noteHealth(channel, health)
    return health
  }

  return { ok: true, status: 'disconnected' }
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
    const status = await provider.getStatus(connection)
    noteHealth(channel, { ok: status === 'connected', status })
    return status
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

export function getLastHealth(channel: ChannelType): ChannelStatus | undefined {
  return lastHealthByChannel.get(channel)
}

export function getActiveProvider(channel: ChannelType): string | undefined {
  return lastProviderByChannel.get(channel)
}
