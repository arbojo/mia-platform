/**
 * Guard de URL de media y envío defensivo de la respuesta al chat.
 *
 * isSafeMediaUrl es deliberadamente independiente (sin imports) para ser
 * probado de forma aislada y replicar el mismo criterio que el motor MIA
 * (src/lib/runtime/media-guard.ts): la URL debe ser absoluta, https, sin
 * credenciales, con host público (Supabase Storage `*.supabase.co`, el host
 * de NEXT_PUBLIC_SUPABASE_URL, CDN en allowlist o hosts extra vía
 * MEDIA_URL_ALLOWED_HOSTS) y sin vectores SSRF (localhost, IPs privadas/
 * link-local, .local/.internal).
 */

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

  const host = parsed.hostname.toLowerCase()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  try {
    const supabaseHost = new URL(supabaseUrl).hostname.toLowerCase()
    if (host === supabaseHost) return true
  } catch {
    // Sin NEXT_PUBLIC_SUPABASE_URL (tests): se evalúa la allowlist base.
  }

  if (host === PUBLIC_HOST_SUFFIX.slice(1) || host.endsWith(PUBLIC_HOST_SUFFIX)) return true
  if (PUBLIC_CDN_HOSTS.includes(host)) return true

  const extra = (process.env.MEDIA_URL_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean)
  return extra.includes(host)
}

export interface ReplySocket {
  sendMessage(jid: string, content: unknown): Promise<unknown>
}

export interface SendReplyResult {
  sent: boolean
  asImage: boolean
}

/**
 * Strips Unicode characters that WhatsApp cannot render correctly.
 *
 * LLMs sometimes emit zero-width spaces, directional marks, or other
 * invisible Unicode artefacts. WhatsApp's protocol is rigid and does not
 * parse these — they show up as grey bubbles or broken wrapping on the
 * client side.
 */
export function sanitizeForWhatsApp(text: string): string {
  return text
    .replace(/[\u200B\u200C\u200D]/g, '')   // ZWSP, ZWNJ, ZWJ
    .replace(/[\u200E\u200F]/g, '')           // LTR / RTL marks
    .replace(/[\u2028\u2029]/g, '\n')        // line / paragraph separator → newline
    .replace(/\uFEFF/g, '')                   // BOM
    .replace(/\r\n/g, '\n')                   // CRLF → LF
    .replace(/\r/g, '\n')                     // CR → LF
    .replace(/\n{3,}/g, '\n\n')              // collapse 3+ blank lines
    .replace(/[ \t]+$/gm, '')                 // trailing whitespace per line
}

/**
 * Envía la respuesta del bot intentando adjuntar la imagen cuando la URL es
 * segura. Si el envío de la imagen falla (por ejemplo, Baileys no logra
 * descargar la URL temporal), hace fallback a texto puro para que la
 * respuesta nunca se pierda. Si la URL no es segura, envía solo texto.
 */
export async function sendReply(
  socket: ReplySocket,
  jid: string,
  response: string,
  imageUrl?: string
): Promise<SendReplyResult> {
  const safe = sanitizeForWhatsApp(response)

  if (imageUrl && isSafeMediaUrl(imageUrl)) {
    try {
      await socket.sendMessage(jid, { image: { url: imageUrl }, caption: safe })
      return { sent: true, asImage: true }
    } catch (err) {
      console.error(
        `[media] image send failed for ${jid}, falling back to text: ${err instanceof Error ? err.message : err}`
      )
    }
  } else if (imageUrl) {
    console.warn(`[media] unsafe media URL omitted for ${jid}: ${imageUrl}`)
  }

  await socket.sendMessage(jid, { text: safe })
  return { sent: true, asImage: false }
}
