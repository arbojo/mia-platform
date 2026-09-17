import { WebChatAdapter } from './adapters/web'
import { WhatsAppAdapter } from './adapters/whatsapp'
import { MessengerAdapter } from './adapters/messenger'
import { WidgetAdapter } from './adapters/widget'
import type { ChannelAdapter, ChannelType } from './types'

const adapters: Record<ChannelType, ChannelAdapter> = {
  web: new WebChatAdapter(),
  whatsapp: new WhatsAppAdapter(),
  messenger: new MessengerAdapter(),
  instagram: new WebChatAdapter(),
  widget: new WidgetAdapter(),
}

export function getAdapter(channel: ChannelType): ChannelAdapter {
  return adapters[channel]
}
