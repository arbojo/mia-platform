import { cnSupabase } from './supabase'

let sessionId: string | null = null
let sessionStart: number = 0

function generateUUID(): string {
  return crypto.randomUUID()
}

function detectDeviceType(): string {
  const w = window.innerWidth
  if (w < 768) return 'mobile'
  if (w < 1024) return 'tablet'
  return 'desktop'
}

function getUtmParam(name: string): string {
  return new URLSearchParams(window.location.search).get(name) || ''
}

export async function startSession(
  landingId = 'clean-nails',
  landingVersion = 'v1'
): Promise<void> {
  if (sessionId || !cnSupabase) return

  const token = generateUUID()
  sessionStart = Date.now()

  const { data, error } = await cnSupabase
    .from('analytics_sessions')
    .insert({
      session_token: token,
      landing_id: landingId,
      landing_version: landingVersion,
      user_agent: navigator.userAgent,
      device_type: detectDeviceType(),
      screen_width: window.screen.width,
      screen_height: window.screen.height,
      language: navigator.language,
      referrer: document.referrer || '',
      utm_source: getUtmParam('utm_source'),
      utm_medium: getUtmParam('utm_medium'),
      utm_campaign: getUtmParam('utm_campaign'),
      utm_content: getUtmParam('utm_content'),
      utm_term: getUtmParam('utm_term'),
      converted: false,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[insights] startSession error:', error)
    return
  }

  sessionId = data.id
  track('landing_open')
}

export async function track(
  eventName: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  if (!sessionId || !cnSupabase) return

  const { error } = await cnSupabase.from('analytics_events').insert({
    session_id: sessionId,
    event_name: eventName,
    seconds_from_start: Math.floor((Date.now() - sessionStart) / 1000),
    metadata: metadata || {},
  })

  if (error) {
    console.error(`[insights] track error (${eventName}):`, error)
  }
}

export async function finishSession(): Promise<void> {
  if (!sessionId || !cnSupabase) return
  await cnSupabase
    .from('analytics_sessions')
    .update({ finished_at: new Date().toISOString() })
    .eq('id', sessionId)
}

export async function setConverted(orderRequestId?: string): Promise<void> {
  if (!sessionId || !cnSupabase) return
  const updates: Record<string, unknown> = { converted: true }
  if (orderRequestId) {
    updates.order_request_id = orderRequestId
  }
  await cnSupabase.from('analytics_sessions').update(updates).eq('id', sessionId)
}
