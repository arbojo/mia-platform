import { WebChatAdapter } from './adapters/web'
import { WhatsAppAdapter } from './adapters/whatsapp'
import type { ChannelAdapter, ChannelType } from './types'

const adapters: Record<ChannelType, ChannelAdapter> = {
  web: new WebChatAdapter(),
  whatsapp: new WhatsAppAdapter(),
  messenger: new WebChatAdapter(),
  instagram: new WebChatAdapter(),
}

export function getAdapter(channel: ChannelType): ChannelAdapter {
  return adapters[channel]
}
