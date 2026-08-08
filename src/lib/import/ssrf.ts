import { isIP } from 'node:net'
import { lookup } from 'node:dns/promises'

const MAX_REDIRECTS = 5
export const MAX_REMOTE_BYTES = 5 * 1024 * 1024
export const REMOTE_TIMEOUT_MS = 10_000

const PRIVATE_V4_PATTERNS: RegExp[] = [
  /^0\./,
  /^127\./,
  /^10\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.0\.2\./,
  /^198\.51\.100\./,
  /^203\.0\.113\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^224\./,
  /^240\./,
]

export function isPrivateIpv4(ip: string): boolean {
  return PRIVATE_V4_PATTERNS.some((pattern) => pattern.test(ip))
}

export function isPrivateIpv6(ip: string): boolean {
  const lower = ip.toLowerCase()
  if (lower === '::' || lower === '::1') return true
  if (lower.startsWith('fe80:')) return true
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true
  if (lower.startsWith('2001:db8:')) return true
  if (lower.startsWith('::ffff:')) return isPrivateIpv4(lower.slice(7))
  return false
}

export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip)
  if (version === 4) return isPrivateIpv4(ip)
  if (version === 6) return isPrivateIpv6(ip)
  return true
}

export class UnsafeHostError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnsafeHostError'
  }
}

export class InvalidUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidUrlError'
  }
}

export async function assertSafeUrl(rawUrl: string): Promise<void> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new InvalidUrlError('Invalid URL')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new InvalidUrlError('Only http/https URLs are allowed')
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '')

  const ipVersion = isIP(hostname)
  if (ipVersion !== 0) {
    if (isPrivateIp(hostname)) {
      throw new UnsafeHostError(`Blocked private/loopback host: ${hostname}`)
    }
    return
  }

  let addresses: string[]
  try {
    const result = await lookup(hostname, { all: true })
    addresses = result.map((entry) => entry.address)
  } catch {
    throw new UnsafeHostError(`Unable to resolve host: ${hostname}`)
  }

  if (addresses.length === 0 || addresses.some((address) => isPrivateIp(address))) {
    throw new UnsafeHostError(`Blocked host resolving to private/loopback address: ${hostname}`)
  }
}

export async function fetchWithRedirectSafety(url: string, init: RequestInit = {}): Promise<Response> {
  let currentUrl = url
  let redirects = 0

  while (true) {
    await assertSafeUrl(currentUrl)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), REMOTE_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(currentUrl, {
        ...init,
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'user-agent': 'MIA-CatalogImport/1.0',
          accept: '*/*',
          ...init.headers,
        },
      })
    } finally {
      clearTimeout(timeout)
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      if (!location) {
        throw new InvalidUrlError('Redirect without location header')
      }
      redirects += 1
      if (redirects > MAX_REDIRECTS) {
        throw new InvalidUrlError('Too many redirects')
      }
      currentUrl = new URL(location, currentUrl).toString()
      response.body?.cancel().catch(() => undefined)
      continue
    }

    return response
  }
}

export async function readBoundedText(response: Response): Promise<string> {
  if (!response.body) {
    throw new InvalidUrlError('Empty response body')
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_REMOTE_BYTES) {
      await reader.cancel().catch(() => undefined)
      throw new InvalidUrlError(`Response exceeds ${MAX_REMOTE_BYTES / (1024 * 1024)} MB limit`)
    }
    chunks.push(value)
  }

  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }

  return new TextDecoder('utf-8').decode(merged)
}

export type SourceContentType = 'json' | 'xml' | 'html' | 'unknown'

export function detectContentType(contentTypeHeader: string | null, text: string): SourceContentType {
  const header = (contentTypeHeader ?? '').toLowerCase()
  if (header.includes('json')) return 'json'
  if (header.includes('xml')) return 'xml'
  if (header.includes('html')) return 'html'

  const trimmed = text.trimStart()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json'
  if (trimmed.startsWith('<')) {
    if (/<\?xml/i.test(trimmed.slice(0, 64))) return 'xml'
    if (/<html|<!doctype/i.test(trimmed.slice(0, 256))) return 'html'
    return 'xml'
  }
  return 'unknown'
}
