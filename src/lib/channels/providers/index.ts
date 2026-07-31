import type { ChannelType } from '../types'
import type { ProviderAdapter } from './types'
import { MetaCloudProvider } from './meta-cloud'

const providers: ProviderAdapter[] = [new MetaCloudProvider()]

export function getProvider(channel: ChannelType): ProviderAdapter | null {
  return providers.find((provider) => provider.channel === channel) ?? null
}

export function registerProvider(provider: ProviderAdapter): void {
  providers.push(provider)
}
