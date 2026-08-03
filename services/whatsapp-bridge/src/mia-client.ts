import type { BridgeConfig } from './config.js'

export interface MiaIncomingMessage {
  businessId: string
  externalId: string
  customerExternalId: string
  customerName: string | null
  customerPhone: string | null
  content: string
  receivedAt: string
}

export interface MiaReply {
  response: string
  customerId: string
  conversationId: string
  imageUrl?: string
  deliver?: boolean
}

/**
 * Forwards an incoming WhatsApp message to MIA's internal webhook
 * (`/api/channels/baileys/webhook`), authenticated with a shared secret.
 */
export async function sendToMia(
  config: BridgeConfig,
  message: MiaIncomingMessage
): Promise<MiaReply | null> {
  const url = new URL('/api/channels/baileys/webhook', config.miaAppUrl).toString()

  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mia-webhook-secret': config.bridgeSecret,
      },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(30_000),
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

  const data = (await res.json()) as {
    success: boolean
    response: string
    customerId: string
    conversationId: string
    imageUrl?: string
    deliver?: boolean
  }
  if (!data.success) return null

  return {
    response: data.response,
    customerId: data.customerId,
    conversationId: data.conversationId,
    imageUrl: data.imageUrl ?? undefined,
    deliver: data.deliver ?? true,
  }
}
