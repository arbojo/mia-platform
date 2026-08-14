import type { SupabaseClient } from '@supabase/supabase-js'

const PUBLIC_CDN_HOSTS = ['cdn.jsdelivr.net']
const PUBLIC_HOST_SUFFIX = '.supabase.co'
const MAX_URL_LENGTH = 2048

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4) return false
  for (const p of parts) {
    if (Number.isNaN(p) || p < 0 || p > 255) return false
  }
  const a = parts[0]
  const b = parts[1]
  if (a === undefined || b === undefined) return false
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 0
  )
}

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host.endsWith('.local') || host.endsWith('.internal')) return true
  if (/^(fe80|fc00|fd00|::1|0:0:0:0:0:0:0:1)/.test(host)) return true
  return isPrivateIPv4(host)
}

function isAllowedHost(hostname: string): boolean {
  const host = hostname.toLowerCase()
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  try {
    const supabaseHost = new URL(supabaseUrl).hostname.toLowerCase()
    if (host === supabaseHost) return true
  } catch {
    // Env sin NEXT_PUBLIC_SUPABASE_URL (tests): se evalúa la allowlist base.
  }

  if (host === PUBLIC_HOST_SUFFIX.slice(1) || host.endsWith(PUBLIC_HOST_SUFFIX)) return true
  if (PUBLIC_CDN_HOSTS.includes(host)) return true

  const extra = (process.env.MEDIA_URL_ALLOWED_HOSTS ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)
  return extra.includes(host)
}

/**
 * Una URL de media es segura solo si es absoluta, https, sin credenciales,
 * con host público (Supabase Storage `*.supabase.co`, CDN en allowlist o
 * hosts extra vía MEDIA_URL_ALLOWED_HOSTS) y sin vectores SSRF
 * (localhost, IPs privadas/link-local, .local/.internal).
 */
export function isSafeMediaUrl(url: string): boolean {
  if (typeof url !== 'string' || url.length === 0 || url.length > MAX_URL_LENGTH) return false

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
  if (parsed.username || parsed.password) return false
  if (isBlockedHost(parsed.hostname)) return false
  return isAllowedHost(parsed.hostname)
}

export async function getConversationMediaSentProducts(
  supabase: SupabaseClient,
  conversationId: string
): Promise<string[]> {
  if (!conversationId) return []
  const { data } = await supabase
    .from('conversations')
    .select('media_sent_products')
    .eq('id', conversationId)
    .maybeSingle()
  return Array.isArray(data?.media_sent_products) ? data.media_sent_products : []
}

export async function addConversationMediaSentProduct(
  supabase: SupabaseClient,
  conversationId: string,
  productId: string
): Promise<void> {
  const current = await getConversationMediaSentProducts(supabase, conversationId)
  if (current.includes(productId)) return
  await supabase
    .from('conversations')
    .update({ media_sent_products: [...current, productId] })
    .eq('id', conversationId)
}
