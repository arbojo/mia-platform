import type {
  ChannelAdapter,
  ChannelConnection,
  ChannelType,
  NormalizedMessage,
  OutgoingMessage,
  SendResult,
  ChannelStatus,
} from '../types'

export class WidgetAdapter implements ChannelAdapter {
  readonly channel: ChannelType = 'widget'

  async receiveMessage(webhookBody: unknown): Promise<NormalizedMessage> {
    const body = webhookBody as {
      message?: string
      customerExternalId?: string
      customerName?: string
      assistantId?: string
    }

    return {
      channel: 'widget',
      externalId: `widget-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      customerExternalId: body.customerExternalId ?? 'anonymous',
      customerName: body.customerName,
      content: body.message ?? '',
      contentType: 'text',
      metadata: {
        assistantId: body.assistantId,
      },
      receivedAt: new Date(),
    }
  }

  async sendMessage(
    _connection: ChannelConnection,
    _message: OutgoingMessage
  ): Promise<SendResult> {
    return {
      success: true,
      externalId: `widget-out-${Date.now()}`,
    }
  }

  validateWebhook(_signature: string, _body: string): boolean {
    return true
  }

  async getStatus(_connection: ChannelConnection): Promise<ChannelStatus> {
    return 'connected'
  }
}
