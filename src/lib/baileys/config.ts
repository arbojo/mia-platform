export function getBridgeUrl(): string {
  return process.env.WHATSAPP_BRIDGE_URL ?? 'http://localhost:8787'
}

export function getBridgeSecret(): string {
  const secret = process.env.WHATSAPP_BRIDGE_SECRET
  if (!secret) {
    throw new Error('WHATSAPP_BRIDGE_SECRET is not configured')
  }
  return secret
}

export function isWhatsAppBridgeEnabled(): boolean {
  return Boolean(process.env.WHATSAPP_BRIDGE_URL && process.env.WHATSAPP_BRIDGE_SECRET)
}
