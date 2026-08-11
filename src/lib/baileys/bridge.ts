import { getBridgeUrl, getBridgeSecret, isWhatsAppBridgeEnabled } from './config'

export interface BridgeSessionStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  phone: string | null
}

export class BridgeClientError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'BridgeClientError'
  }
}

async function bridgeFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${getBridgeUrl()}${path}`
  return fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-mia-bridge-secret': getBridgeSecret(),
      ...init?.headers,
    },
  })
}

export async function startBridgeSession(businessId: string): Promise<BridgeSessionStatus> {
  const res = await bridgeFetch(`/v1/sessions/${encodeURIComponent(businessId)}/start`, {
    method: 'POST',
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null
    throw new BridgeClientError(err?.error ?? `Bridge error HTTP ${res.status}`, res.status)
  }
  const data = (await res.json()) as BridgeSessionStatus
  return data
}

export async function getBridgeSessionStatus(businessId: string): Promise<BridgeSessionStatus> {
  const res = await bridgeFetch(`/v1/sessions/${encodeURIComponent(businessId)}/status`)
  if (!res.ok) {
    throw new BridgeClientError(`Bridge error HTTP ${res.status}`, res.status)
  }
  const data = (await res.json()) as BridgeSessionStatus
  return data
}

export async function logoutBridgeSession(businessId: string): Promise<void> {
  const res = await bridgeFetch(`/v1/sessions/${encodeURIComponent(businessId)}/logout`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    throw new BridgeClientError(`Bridge error HTTP ${res.status}`, res.status)
  }
}

export async function reconnectBridgeSession(businessId: string): Promise<BridgeSessionStatus> {
  const res = await bridgeFetch(`/v1/sessions/${encodeURIComponent(businessId)}/reconnect`, {
    method: 'POST',
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null
    throw new BridgeClientError(err?.error ?? `Bridge error HTTP ${res.status}`, res.status)
  }
  const data = (await res.json()) as BridgeSessionStatus
  return data
}

export { isWhatsAppBridgeEnabled }
