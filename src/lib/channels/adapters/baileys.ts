import type {
  ChannelAdapter,
  ChannelConnection,
  ChannelStatus,
  NormalizedMessage,
  OutgoingMessage,
  SendResult,
} from '../types'
import { getBridgeUrl, getBridgeSecret, isWhatsAppBridgeEnabled } from '@/lib/baileys/config'

/**
 * Baileys channel adapter.
 *
 * The actual WhatsApp Web session lives in the dedicated bridge process
 * (services/whatsapp-bridge). This adapter is the MIA-side contract that
 * the runtime uses to normalize inbound messages and send outbound ones
 * through the bridge's HTTP API.
 */
export class BaileysAdapter implements ChannelAdapter {
  readonly channel = 'whatsapp' as const

  async receiveMessage(
    webhookBody: unknown,
    _headers?: Record<string, string>
  ): Promise<NormalizedMessage> {
    const body = webhookBody as {
      message?: {
        businessId?: string
        externalId?: string
        customerExternalId?: string
        customerName?: string | null
        customerPhone?: string | null
        content?: string
        contentType?: 'text' | 'image' | 'audio' | 'document'
        receivedAt?: string
      }
    }

    const message = body.message
    if (!message?.content) {
      throw new Error('Invalid Baileys message format')
    }

    return {
      channel: 'whatsapp',
      externalId: message.externalId ?? '',
      customerExternalId: message.customerExternalId ?? '',
      customerName: message.customerName ?? undefined,
      customerPhone: message.customerPhone ?? undefined,
      content: message.content,
      contentType: message.contentType ?? 'text',
      metadata: {
        businessId: message.businessId,
      },
      receivedAt: message.receivedAt ? new Date(message.receivedAt) : new Date(),
    }
  }

  async sendMessage(
    _connection: ChannelConnection,
    message: OutgoingMessage
  ): Promise<SendResult> {
    if (!isWhatsAppBridgeEnabled()) {
      return { success: false, error: 'WhatsApp bridge is not configured' }
    }

    const to = message.metadata?.to as string | undefined
    const businessId = message.metadata?.businessId as string | undefined
    if (!to || !businessId) {
      return { success: false, error: 'Missing to/businessId in message metadata' }
    }

    try {
      const res = await fetch(
        `${getBridgeUrl()}/v1/sessions/${encodeURIComponent(businessId)}/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-mia-bridge-secret': getBridgeSecret(),
          },
          body: JSON.stringify({ to, content: message.content }),
        }
      )

      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null
        return { success: false, error: err?.error ?? `HTTP ${res.status}` }
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  validateWebhook(_signature: string, _body: string): boolean {
    // The bridge authenticates with a shared secret header, not a body signature.
    return true
  }

  async getStatus(_connection: ChannelConnection): Promise<ChannelStatus> {
    if (!isWhatsAppBridgeEnabled()) return 'disconnected'

    try {
      const businessId = _connection.businessId
      const res = await fetch(
        `${getBridgeUrl()}/v1/sessions/${encodeURIComponent(businessId)}/status`,
        { headers: { 'x-mia-bridge-secret': getBridgeSecret() } }
      )
      if (!res.ok) return 'error'
      const data = (await res.json()) as { status: ChannelStatus }
      return data.status
    } catch {
      return 'error'
    }
  }
}
