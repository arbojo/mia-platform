import { createHmac, timingSafeEqual } from 'node:crypto'
import type {
  ChannelConnection,
  ChannelType,
  NormalizedMessage,
  OutgoingMessage,
  SendResult,
  ChannelStatus,
} from '../types'
import type { ProviderAdapter } from './types'

const GRAPH_API_VERSION = 'v19.0'

interface MockSentRecord {
  at: string
  to: string
  content: string
  externalId: string
}

const mockSentRecords: MockSentRecord[] = []

export function getMockSentRecords(): MockSentRecord[] {
  return mockSentRecords
}

function resolveCredential(
  connection: ChannelConnection | null,
  key: string,
  envName?: string
): string | undefined {
  const fromConnection = connection?.credentials?.[key]
  if (typeof fromConnection === 'string' && fromConnection.length > 0) {
    return fromConnection
  }
  return envName ? process.env[envName] : undefined
}

function isMockMode(connection: ChannelConnection | null): boolean {
  const flag = process.env.WHATSAPP_MOCK
  if (flag !== undefined && flag.length > 0) {
    return flag === 'true'
  }
  const accessToken = resolveCredential(connection, 'access_token', 'WHATSAPP_ACCESS_TOKEN')
  return !accessToken
}

export class MetaCloudProvider implements ProviderAdapter {
  readonly id = 'meta-cloud'
  readonly channel: ChannelType = 'whatsapp'

  async send(connection: ChannelConnection, message: OutgoingMessage): Promise<SendResult> {
    if (isMockMode(connection)) {
      return this.sendMock(message)
    }

    const accessToken = resolveCredential(connection, 'access_token', 'WHATSAPP_ACCESS_TOKEN')
    const phoneNumberId = resolveCredential(connection, 'phone_number_id', 'WHATSAPP_PHONE_NUMBER_ID')
    const to = message.metadata?.to

    if (!accessToken) {
      return { success: false, error: 'Meta Cloud: access_token not configured' }
    }
    if (!phoneNumberId) {
      return { success: false, error: 'Meta Cloud: phone_number_id not configured' }
    }
    if (typeof to !== 'string' || to.length === 0) {
      return { success: false, error: 'Meta Cloud: missing recipient (metadata.to)' }
    }

    try {
      const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: message.content },
        }),
      })

      const payload = (await response.json().catch(() => ({}))) as {
        messages?: Array<{ id?: string }>
        error?: { message?: string }
      }

      if (!response.ok) {
        return {
          success: false,
          error: payload.error?.message ?? `Meta Cloud API ${response.status}`,
        }
      }

      return { success: true, externalId: payload.messages?.[0]?.id }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  async receiveMessage(webhookBody: unknown): Promise<NormalizedMessage | null> {
    const body = webhookBody as {
      entry?: Array<{
        changes?: Array<{
          value?: {
            messages?: Array<{
              id?: string
              from?: string
              text?: { body?: string }
              type?: string
            }>
            contacts?: Array<{
              wa_id?: string
              profile?: { name?: string }
            }>
            metadata?: {
              phone_number_id?: string
              display_phone_number?: string
            }
          }
        }>
      }>
    }

    const change = body.entry?.[0]?.changes?.[0]
    const message = change?.value?.messages?.[0]

    if (!message) {
      return null
    }

    const contact = change?.value?.contacts?.[0]
    const metadata = change?.value?.metadata

    return {
      channel: 'whatsapp',
      externalId: message.id ?? '',
      customerExternalId: message.from ?? '',
      customerName: contact?.profile?.name,
      customerPhone: message.from,
      content: message.text?.body ?? '',
      contentType: message.type === 'text' ? 'text' : 'text',
      metadata: {
        waId: message.from,
        phoneNumberId: metadata?.phone_number_id,
        displayPhoneNumber: metadata?.display_phone_number,
      },
      receivedAt: new Date(),
    }
  }

  validateWebhook(
    connection: ChannelConnection | null,
    signature: string,
    body: string
  ): boolean {
    if (isMockMode(connection)) {
      return true
    }

    const appSecret = resolveCredential(connection, 'app_secret', 'WHATSAPP_APP_SECRET')
    if (!appSecret) {
      return false
    }

    const expected = `sha256=${createHmac('sha256', appSecret).update(body).digest('hex')}`

    try {
      const actualBuffer = Buffer.from(signature)
      const expectedBuffer = Buffer.from(expected)
      if (actualBuffer.length !== expectedBuffer.length) {
        return false
      }
      return timingSafeEqual(actualBuffer, expectedBuffer)
    } catch {
      return false
    }
  }

  async getStatus(connection: ChannelConnection): Promise<ChannelStatus> {
    if (isMockMode(connection)) {
      return 'connected'
    }

    const accessToken = resolveCredential(connection, 'access_token', 'WHATSAPP_ACCESS_TOKEN')
    const phoneNumberId = resolveCredential(connection, 'phone_number_id', 'WHATSAPP_PHONE_NUMBER_ID')

    return accessToken && phoneNumberId ? 'connected' : 'disconnected'
  }

  async verifySubscription(params: URLSearchParams): Promise<{ valid: boolean; challenge: string | null }> {
    const mode = params.get('hub.mode')
    const token = params.get('hub.verify_token')
    const challenge = params.get('hub.challenge')
    const expected = process.env.WHATSAPP_VERIFY_TOKEN

    if (mode === 'subscribe' && token && (expected ? token === expected : isMockMode(null))) {
      return { valid: true, challenge }
    }

    return { valid: false, challenge: null }
  }

  private sendMock(message: OutgoingMessage): SendResult {
    const externalId = `mock-wamid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    mockSentRecords.push({
      at: new Date().toISOString(),
      to: typeof message.metadata?.to === 'string' ? message.metadata.to : '',
      content: message.content,
      externalId,
    })
    return { success: true, externalId }
  }
}
