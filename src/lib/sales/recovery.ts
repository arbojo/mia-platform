/**
 * Commercial conversation recovery — pure decision helpers.
 *
 * When MIA answers a commercial enquiry and the customer goes quiet, MIA
 * re-engages them with AT MOST four messages: at 10 minutes, 2 hours, 6 hours
 * and 23 hours, all measured from the customer's last inbound message. A newer
 * inbound message restarts the clock (and therefore cancels the pending
 * attempts of the previous "inbound version").
 *
 * The final attempt lands at 23h — not 24h — on purpose: WhatsApp's customer
 * service window closes 24h after the customer's last inbound, so staying an
 * hour inside the window keeps every re-engagement a free-form continuation of
 * the open conversation instead of a re-initiation that reads as spam.
 *
 * Everything here is side-effect free so it can be unit-tested without a
 * database. Persistence (the attempt markers) lives in the bridge worker and
 * the scan service.
 *
 * Anti-spam guardrails modelled here:
 * - Opt-out: a customer who asked to stop (`customers.recovery_opt_out_at`) is
 *   never recovered.
 * - Quiet hours: attempts are only emitted inside the business's local sending
 *   window (`business_sales_config`), so MIA does not message people at night.
 *
 * Known limitation: opt-out detection from free text (matching "STOP" and
 * friends in an inbound message) lives in the runtime wiring, not here; this
 * module only honours the persisted flag.
 */

export type RecoveryAttempt = 1 | 2 | 3 | 4

/** First attempt: 10 minutes after the customer's last inbound message. */
export const RECOVERY_ATTEMPT_1_DELAY_MS = 10 * 60_000
/** Second attempt: 2 hours after the customer's last inbound message. */
export const RECOVERY_ATTEMPT_2_DELAY_MS = 2 * 60 * 60_000
/** Third attempt: 6 hours after the customer's last inbound message. */
export const RECOVERY_ATTEMPT_3_DELAY_MS = 6 * 60 * 60_000
/**
 * Fourth and final attempt: 23 hours after the customer's last inbound
 * message. Deliberately one hour inside the 24h customer service window.
 */
export const RECOVERY_ATTEMPT_4_DELAY_MS = 23 * 60 * 60_000
/**
 * Conservative operational ceiling. Beyond 24h we never recover: the WhatsApp
 * customer service window has closed and a message that stale reads as spam.
 * This is a product guardrail, not a WhatsApp Business Platform policy claim
 * (the bridge uses Baileys).
 */
export const RECOVERY_WINDOW_MS = 24 * 60 * 60_000

export const RECOVERY_ATTEMPT_1_TEXT =
  '¡Hola! 😊 ¿Pudiste revisar la información que te compartí? Si te quedó alguna duda, con gusto te ayudo.'

export const RECOVERY_ATTEMPT_2_TEXT =
  '¡Aquí sigo para ayudarte! 😊 Si quieres conocer algún detalle más sobre el producto que te interesó, pregúntame con confianza.'

export const RECOVERY_ATTEMPT_3_TEXT =
  'Hola 👋 Sigo por aquí. Si tenías alguna duda sobre lo que te compartí, con gusto te la resuelvo — sin compromiso.'

export const RECOVERY_ATTEMPT_4_TEXT =
  'Hola, no quiero molestarte más. Si te interesa, contame y te ayudo; y si preferís que no vuelva a escribirte, respondé *STOP* y listo. 🙏'

const RECOVERY_TEXTS: Record<RecoveryAttempt, string> = {
  1: RECOVERY_ATTEMPT_1_TEXT,
  2: RECOVERY_ATTEMPT_2_TEXT,
  3: RECOVERY_ATTEMPT_3_TEXT,
  4: RECOVERY_ATTEMPT_4_TEXT,
}

export function recoveryTextFor(attempt: RecoveryAttempt): string {
  return RECOVERY_TEXTS[attempt]
}

export interface RecoveryEligibilityState {
  /** `conversations.status` of the live thread. */
  conversationStatus: string | null
  /** `conversations.ai_paused_at` — non-null means a human currently owns it. */
  aiPausedAt: string | null
  /** `conversations.sales_cancelled_at` — non-null means the sale was cancelled. */
  salesCancelledAt: string | null
  /** A SALE_WON is the latest closing event with no newer open cycle. */
  hasConfirmedOrder: boolean
  /** SALE_LOST (latest closing) or a rejected outcome/customer status. */
  hasRejectedOffer: boolean
  /** At least one SALE_STARTED / PRODUCT_SELECTED exists in the thread. */
  hasCommercialConsultation: boolean
  /** ISO timestamp of the customer's last inbound message, if determinable. */
  lastInboundAt: string | null
  /** ISO timestamp of MIA's last outbound message on the thread. */
  lastMiaOutboundAt: string | null
  customerPhone: string | null
  /** A WhatsApp connection is connected and in `active` mode. */
  connectionAvailable: boolean
  /** The customer asked to stop being contacted (opt-out). */
  optedOut: boolean
}

export type RecoveryEligibilityReason =
  | 'eligible'
  | 'no_phone'
  | 'connection_unavailable'
  | 'inbound_undeterminable'
  | 'not_commercial'
  | 'conversation_closed'
  | 'human_takeover'
  | 'sales_cancelled'
  | 'confirmed_order'
  | 'offer_rejected'
  | 'awaiting_mia_reply'
  | 'opted_out'

export interface RecoveryEligibility {
  eligible: boolean
  reason: RecoveryEligibilityReason
}

/**
 * Re-runnable eligibility check. Every condition is derived from current DB
 * state, so a candidate that stops qualifying between scans simply drops out —
 * there is no stored task to invalidate.
 */
export function resolveRecoveryEligibility(
  state: RecoveryEligibilityState
): RecoveryEligibility {
  if (state.optedOut) {
    return { eligible: false, reason: 'opted_out' }
  }
  if (!state.customerPhone || !state.customerPhone.trim()) {
    return { eligible: false, reason: 'no_phone' }
  }
  if (!state.connectionAvailable) {
    return { eligible: false, reason: 'connection_unavailable' }
  }
  if (!state.lastInboundAt) {
    return { eligible: false, reason: 'inbound_undeterminable' }
  }
  if (!state.hasCommercialConsultation) {
    return { eligible: false, reason: 'not_commercial' }
  }
  if (state.conversationStatus !== 'active') {
    return { eligible: false, reason: 'conversation_closed' }
  }
  if (state.aiPausedAt) {
    return { eligible: false, reason: 'human_takeover' }
  }
  if (state.salesCancelledAt) {
    return { eligible: false, reason: 'sales_cancelled' }
  }
  if (state.hasConfirmedOrder) {
    return { eligible: false, reason: 'confirmed_order' }
  }
  if (state.hasRejectedOffer) {
    return { eligible: false, reason: 'offer_rejected' }
  }
  if (
    !state.lastMiaOutboundAt ||
    new Date(state.lastMiaOutboundAt).getTime() <=
      new Date(state.lastInboundAt).getTime()
  ) {
    return { eligible: false, reason: 'awaiting_mia_reply' }
  }
  return { eligible: true, reason: 'eligible' }
}

export interface RecoveryAttemptSelectionParams {
  /** Current time, ms epoch. */
  now: number
  /** Last customer inbound, ms epoch (also the "inbound version"). */
  lastInboundAt: number
  /** An attempt-1 message was already persisted for this inbound version. */
  attempt1SentForVersion: boolean
  /** An attempt-2 message was already persisted for this inbound version. */
  attempt2SentForVersion: boolean
  /** An attempt-3 message was already persisted for this inbound version. */
  attempt3SentForVersion: boolean
  /** An attempt-4 message was already persisted for this inbound version. */
  attempt4SentForVersion: boolean
}

/**
 * Which attempt (if any) is due right now.
 *
 * The sequence is strictly ordered: each attempt only fires once every earlier
 * attempt was sent for the same inbound version. If the worker missed an earlier
 * window we do not jump ahead (a 6h message without the 2h one reads as a cold
 * re-contact and hurts sender quality). Never beyond the 24h ceiling.
 *
 * - Before 10 minutes: nothing.
 * - 10 minutes <= Δ < 2 hours: attempt 1, unless it was already sent.
 * - 2 hours <= Δ < 6 hours: attempt 2, only if attempt 1 was sent.
 * - 6 hours <= Δ < 23 hours: attempt 3, only if attempts 1 and 2 were sent.
 * - 23 hours <= Δ < 24 hours: attempt 4, only if attempts 1, 2 and 3 were sent.
 */
export function selectDueAttempt(
  params: RecoveryAttemptSelectionParams
): RecoveryAttempt | null {
  const delta = params.now - params.lastInboundAt
  if (delta < 0 || delta >= RECOVERY_WINDOW_MS) return null

  if (delta >= RECOVERY_ATTEMPT_4_DELAY_MS) {
    if (
      params.attempt1SentForVersion &&
      params.attempt2SentForVersion &&
      params.attempt3SentForVersion &&
      !params.attempt4SentForVersion
    ) {
      return 4
    }
    return null
  }

  if (delta >= RECOVERY_ATTEMPT_3_DELAY_MS) {
    if (
      params.attempt1SentForVersion &&
      params.attempt2SentForVersion &&
      !params.attempt3SentForVersion
    ) {
      return 3
    }
    return null
  }

  if (delta >= RECOVERY_ATTEMPT_2_DELAY_MS) {
    if (params.attempt1SentForVersion && !params.attempt2SentForVersion) return 2
    return null
  }

  if (delta >= RECOVERY_ATTEMPT_1_DELAY_MS && !params.attempt1SentForVersion) {
    return 1
  }

  return null
}

export interface SendingHoursParams {
  /** Current time, ms epoch. */
  now: number
  /** IANA timezone of the business, e.g. `America/Argentina/Buenos_Aires`. */
  timezone: string
  /** Local hour (0-23) from which recovery may be sent (inclusive). */
  startHour: number
  /** Local hour (1-24) after which recovery must stop (exclusive). */
  endHour: number
}

/**
 * Whether `now` falls inside the business's local sending window. Used as a
 * gate, not a scheduler: when a due attempt lands outside the window the scan
 * simply does not emit it and the next scan (inside the window) picks it up — or
 * the 24h ceiling drops it. Fails open (returns true) if the timezone is
 * invalid, so a config typo never silently disables recovery; the primary
 * anti-spam controls are opt-out and frequency.
 *
 * Supports overnight windows (start > end), e.g. 20 → 9 means
 * [20:00, 24:00) ∪ [00:00, 09:00).
 */
export function isWithinSendingHours(params: SendingHoursParams): boolean {
  const hour = localHour(params.now, params.timezone)
  if (hour === null) return true
  const { startHour, endHour } = params
  if (startHour <= endHour) {
    return hour >= startHour && hour < endHour
  }
  return hour >= startHour || hour < endHour
}

/** Local hour (0-23) in the given timezone, or null if it cannot be resolved. */
function localHour(nowMs: number, timezone: string): number | null {
  try {
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).format(new Date(nowMs))
    const hour = Number.parseInt(formatted, 10)
    if (Number.isNaN(hour)) return null
    return hour === 24 ? 0 : hour
  } catch {
    return null
  }
}
