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
  /**
   * El mensaje lo escribió una persona del negocio desde el mismo número del
   * bridge, no un cliente. Se persiste como material de aprendizaje y NO
   * dispara respuesta automática ni efectos comerciales.
   */
  fromHuman?: boolean
}

export interface MiaReply {
  response: string
  customerId: string
  conversationId: string
  imageUrl?: string
  mediaType?: 'image' | 'testimonial'
  interactive?: InteractiveComponent
  deliver?: boolean
  /** Business the reply belongs to; echoed so receipts are reported per tenant. */
  businessId: string
  /**
   * Row id MIA created for this reply. Only present when `deliver` is true: the
   * bridge must report the real send outcome for it, otherwise the row stays
   * `processing` and MIA never learns whether WhatsApp accepted the message.
   */
  outgoingMessageId?: string
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
        outgoingMessageId?: string | null
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
    businessId: message.businessId,
    outgoingMessageId: data.outgoingMessageId ?? undefined,
  }
}

/**
 * Reports the real outcome of a send attempt to MIA.
 *
 * MIA writes the outgoing row before the bridge sends, so it has to guess
 * `processing`. This is the only place that knows whether WhatsApp actually
 * accepted the message — without it a failed send keeps claiming success
 * forever. Never throws: a receipt that cannot be delivered must not break the
 * send path that already succeeded.
 */
export async function reportDelivery(
  config: BridgeConfig,
  receipt: {
    businessId: string
    outgoingMessageId: string
    status: 'sent' | 'failed'
    externalId?: string | null
    error?: string
  },
  timeoutMs?: number
): Promise<boolean> {
  const url = new URL('/api/channels/baileys/delivery', config.miaAppUrl).toString()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-mia-business-id': receipt.businessId,
  }

  if (isBridgeJwtConfigured()) {
    headers['X-MIA-Token'] = await signBridgeToken(receipt.businessId, 'bridge-webhook')
  } else {
    headers['x-mia-webhook-secret'] = config.bridgeSecret
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        outgoingMessageId: receipt.outgoingMessageId,
        status: receipt.status,
        externalId: receipt.externalId ?? null,
        error: receipt.error,
      }),
      signal: AbortSignal.timeout(timeoutMs ?? 10_000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`Delivery receipt rejected ${res.status}: ${text}`)
      return false
    }
    return true
  } catch (error) {
    console.error(
      `Delivery receipt unreachable: ${error instanceof Error ? error.message : error}`
    )
    return false
  }
}
