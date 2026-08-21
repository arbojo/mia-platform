import { getBridgeUrl, getBridgeSecret, isWhatsAppBridgeEnabled } from './config'
import {
  isBridgeJwtConfigured,
  signBridgeToken,
  signLegacySessionToken,
} from '@/lib/platform/jwt'

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

async function bridgeAuthHeaders(businessId: string): Promise<Record<string, string>> {
  if (isBridgeJwtConfigured()) {
    const token = await signBridgeToken(businessId, 'bridge-api')
    return { Authorization: `Bearer ${token}` }
  }
  return { 'x-mia-bridge-secret': getBridgeSecret() }
}

async function bridgeFetch(path: string, businessId: string, init?: RequestInit): Promise<Response> {
  const url = `${getBridgeUrl()}${path}`
  const authHeaders = await bridgeAuthHeaders(businessId)
  return fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...init?.headers,
    },
  })
}

export async function startBridgeSession(businessId: string): Promise<BridgeSessionStatus> {
  const res = await bridgeFetch(`/v1/sessions/${encodeURIComponent(businessId)}/start`, businessId, {
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
  const res = await bridgeFetch(`/v1/sessions/${encodeURIComponent(businessId)}/status`, businessId)
  if (!res.ok) {
    throw new BridgeClientError(`Bridge error HTTP ${res.status}`, res.status)
  }
  const data = (await res.json()) as BridgeSessionStatus
  return data
}

export async function logoutBridgeSession(businessId: string): Promise<void> {
  const res = await bridgeFetch(`/v1/sessions/${encodeURIComponent(businessId)}/logout`, businessId, {
    method: 'DELETE',
  })
  if (!res.ok) {
    throw new BridgeClientError(`Bridge error HTTP ${res.status}`, res.status)
  }
}

export async function reconnectBridgeSession(businessId: string): Promise<BridgeSessionStatus> {
  const res = await bridgeFetch(`/v1/sessions/${encodeURIComponent(businessId)}/reconnect`, businessId, {
    method: 'POST',
  })
  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as { error?: string } | null
    throw new BridgeClientError(err?.error ?? `Bridge error HTTP ${res.status}`, res.status)
  }
  const data = (await res.json()) as BridgeSessionStatus
  return data
}

export async function signBridgeWsToken(businessId: string): Promise<string> {
  if (isBridgeJwtConfigured()) {
    return signBridgeToken(businessId, 'bridge-ws')
  }
  return signLegacySessionToken(getBridgeSecret(), businessId)
}

export { isWhatsAppBridgeEnabled, isBridgeJwtConfigured }
