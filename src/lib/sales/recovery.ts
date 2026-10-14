/**
 * Commercial conversation recovery — pure decision helpers.
 *
 * When MIA answers a commercial enquiry and the customer goes quiet, MIA
 * re-engages them with AT MOST two messages: one at 10 minutes and one at 2
 * hours, both measured from the customer's last inbound message. A newer
 * inbound message restarts the clock (and therefore cancels the pending
 * attempts of the previous "inbound version").
 *
 * Everything here is side-effect free so it can be unit-tested without a
 * database. Persistence (the attempt markers) lives in the bridge worker and
 * the scan service.
 *
 * Known limitation: the platform has no opt-out / "do not contact" mechanism
 * (there is no column, flag or event for it). Only an explicit REFUSAL is
 * modelled (`not_interested` / customer status `lost` / `SALE_LOST`), which
 * this module honours. A customer asking to stop being contacted is therefore
 * NOT detectable today; that condition is documented rather than faked with a
 * heuristic.
 */

export type RecoveryAttempt = 1 | 2

/** First attempt: 10 minutes after the customer's last inbound message. */
export const RECOVERY_ATTEMPT_1_DELAY_MS = 10 * 60_000
/** Second attempt: 2 hours after the customer's last inbound message. */
export const RECOVERY_ATTEMPT_2_DELAY_MS = 2 * 60 * 60_000
/**
 * Conservative operational ceiling. Beyond 24h we never recover: a message
 * that stale reads as spam and the number may no longer be reachable. This is
 * a product guardrail, not a WhatsApp Business Platform policy claim (the
 * bridge uses Baileys).
 */
export const RECOVERY_WINDOW_MS = 24 * 60 * 60_000

export const RECOVERY_ATTEMPT_1_TEXT =
  '¡Hola! 😊 ¿Pudiste revisar la información que te compartí? Si te quedó alguna duda, con gusto te ayudo.'

export const RECOVERY_ATTEMPT_2_TEXT =
  '¡Aquí sigo para ayudarte! 😊 Si quieres conocer algún detalle más sobre el producto que te interesó, pregúntame con confianza.'

export function recoveryTextFor(attempt: RecoveryAttempt): string {
  return attempt === 1 ? RECOVERY_ATTEMPT_1_TEXT : RECOVERY_ATTEMPT_2_TEXT
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
}

/**
 * Which attempt (if any) is due right now.
 *
 * - Before 10 minutes: nothing.
 * - 10 minutes <= Δ < 2 hours: attempt 1, unless it was already sent.
 * - Δ >= 2 hours: attempt 2, but only if attempt 1 was sent for this version
 *   (sequence integrity — if the worker missed the first window we do not jump
 *   straight to the second message). Never beyond the 24h ceiling.
 */
export function selectDueAttempt(
  params: RecoveryAttemptSelectionParams
): RecoveryAttempt | null {
  const delta = params.now - params.lastInboundAt
  if (delta < 0 || delta >= RECOVERY_WINDOW_MS) return null

  if (delta >= RECOVERY_ATTEMPT_2_DELAY_MS) {
    if (params.attempt1SentForVersion && !params.attempt2SentForVersion) return 2
    return null
  }

  if (delta >= RECOVERY_ATTEMPT_1_DELAY_MS && !params.attempt1SentForVersion) {
    return 1
  }

  return null
}
