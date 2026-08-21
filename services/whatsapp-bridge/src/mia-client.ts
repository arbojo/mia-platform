import type { BridgeConfig } from './config.js'
import type { InteractiveComponent, MessagePayload } from './session-manager.js'
import { isBridgeJwtConfigured, signBridgeToken } from './jwt.js'

export interface MiaIncomingMessage {
  businessId: string
  externalId: string
  customerExternalId: string
  customerName: string | null
  customerPhone: string | null
  content: string
  payload?: MessagePayload
  receivedAt: string
}

export interface MiaReply {
  response: string
  customerId: string
  conversationId: string
  imageUrl?: string
  mediaType?: 'image' | 'testimonial'
  interactive?: InteractiveComponent
  deliver?: boolean
}

/**
 * Forwards an incoming WhatsApp message to MIA's internal webhook
 * (`/api/channels/baileys/webhook`), authenticated with a shared secret.
 */
export async function sendToMia(
  config: BridgeConfig,
  message: MiaIncomingMessage,
  timeoutMs?: number
): Promise<MiaReply | null> {
  const url = new URL('/api/channels/baileys/webhook', config.miaAppUrl).toString()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (isBridgeJwtConfigured()) {
    headers['X-MIA-Token'] = await signBridgeToken(message.businessId, 'bridge-webhook')
  } else {
    headers['x-mia-webhook-secret'] = config.bridgeSecret
  }

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(timeoutMs ?? 30_000),
    })
  } catch (error) {
    // MIA app unreachable (ECONNREFUSED, timeout, DNS...). Never throw: the
    // bridge must stay alive even if the engine is down.
    console.error(
      `MIA webhook unreachable: ${error instanceof Error ? error.message : error}`
    )
    return null
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    console.error(`MIA webhook error ${res.status}: ${text}`)
    return null
  }

  const data = (await res.json().catch(() => null)) as
    | {
        success: boolean
        response: string
        customerId: string
        conversationId: string
        imageUrl?: string
        mediaType?: 'image' | 'testimonial'
        interactive?: InteractiveComponent
        deliver?: boolean
      }
    | null
  if (!data || !data.success) return null

  return {
    response: data.response,
    customerId: data.customerId,
    conversationId: data.conversationId,
    imageUrl: data.imageUrl ?? undefined,
    mediaType: data.mediaType ?? undefined,
    interactive: data.interactive ?? undefined,
    deliver: data.deliver ?? true,
  }
}
