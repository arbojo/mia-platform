import { describe, it, expect } from 'vitest'
import {
  RECOVERY_ATTEMPT_1_DELAY_MS,
  RECOVERY_ATTEMPT_2_DELAY_MS,
  RECOVERY_ATTEMPT_1_TEXT,
  RECOVERY_ATTEMPT_2_TEXT,
  RECOVERY_WINDOW_MS,
  recoveryTextFor,
  resolveRecoveryEligibility,
  selectDueAttempt,
  type RecoveryEligibilityState,
} from '../../src/lib/sales/recovery'

const NOW = new Date('2026-02-01T12:00:00.000Z').getTime()
const MIN = 60_000
const HOUR = 60 * MIN

function baseState(overrides: Partial<RecoveryEligibilityState> = {}): RecoveryEligibilityState {
  return {
    conversationStatus: 'active',
    aiPausedAt: null,
    salesCancelledAt: null,
    hasConfirmedOrder: false,
    hasRejectedOffer: false,
    hasCommercialConsultation: true,
    lastInboundAt: new Date(NOW - 15 * MIN).toISOString(),
    lastMiaOutboundAt: new Date(NOW - 12 * MIN).toISOString(),
    customerPhone: '5214771234567',
    connectionAvailable: true,
    ...overrides,
  }
}

describe('recovery texts', () => {
  it('maps each attempt to its default message', () => {
    expect(recoveryTextFor(1)).toBe(RECOVERY_ATTEMPT_1_TEXT)
    expect(recoveryTextFor(2)).toBe(RECOVERY_ATTEMPT_2_TEXT)
  })
})

describe('resolveRecoveryEligibility', () => {
  it('accepts the happy path: MIA answered a commercial enquiry and the customer is silent', () => {
    expect(resolveRecoveryEligibility(baseState())).toEqual({
      eligible: true,
      reason: 'eligible',
    })
  })

  it('rejects when the customer has no phone', () => {
    expect(resolveRecoveryEligibility(baseState({ customerPhone: null })).reason).toBe('no_phone')
  })

  it('rejects when the connection is unavailable', () => {
    expect(
      resolveRecoveryEligibility(baseState({ connectionAvailable: false })).reason
    ).toBe('connection_unavailable')
  })

  it('rejects when the last inbound message cannot be determined', () => {
    expect(resolveRecoveryEligibility(baseState({ lastInboundAt: null })).reason).toBe(
      'inbound_undeterminable'
    )
  })

  it('rejects non-commercial conversations', () => {
    expect(
      resolveRecoveryEligibility(baseState({ hasCommercialConsultation: false })).reason
    ).toBe('not_commercial')
  })

  it('rejects a conversation that is no longer active', () => {
    expect(resolveRecoveryEligibility(baseState({ conversationStatus: 'waiting' })).reason).toBe(
      'conversation_closed'
    )
  })

  it('rejects while a human owns the conversation (takeover)', () => {
    expect(
      resolveRecoveryEligibility(baseState({ aiPausedAt: new Date(NOW - MIN).toISOString() }))
        .reason
    ).toBe('human_takeover')
  })

  it('rejects a cancelled sale', () => {
    expect(
      resolveRecoveryEligibility(
        baseState({ salesCancelledAt: new Date(NOW - MIN).toISOString() })
      ).reason
    ).toBe('sales_cancelled')
  })

  it('rejects when an order was confirmed', () => {
    expect(resolveRecoveryEligibility(baseState({ hasConfirmedOrder: true })).reason).toBe(
      'confirmed_order'
    )
  })

  it('rejects when the customer already refused the offer', () => {
    expect(resolveRecoveryEligibility(baseState({ hasRejectedOffer: true })).reason).toBe(
      'offer_rejected'
    )
  })

  it('rejects when the customer wrote after MIA and is awaiting a reply', () => {
    expect(
      resolveRecoveryEligibility(
        baseState({ lastMiaOutboundAt: new Date(NOW - 20 * MIN).toISOString() })
      ).reason
    ).toBe('awaiting_mia_reply')
  })

  it('rejects when MIA never answered', () => {
    expect(resolveRecoveryEligibility(baseState({ lastMiaOutboundAt: null })).reason).toBe(
      'awaiting_mia_reply'
    )
  })
})

describe('selectDueAttempt', () => {
  const params = (overrides: Partial<Parameters<typeof selectDueAttempt>[0]> = {}) => ({
    now: NOW,
    lastInboundAt: NOW - RECOVERY_ATTEMPT_1_DELAY_MS,
    attempt1SentForVersion: false,
    attempt2SentForVersion: false,
    ...overrides,
  })

  it('does nothing before 10 minutes', () => {
    expect(
      selectDueAttempt(params({ lastInboundAt: NOW - (RECOVERY_ATTEMPT_1_DELAY_MS - 1000) }))
    ).toBeNull()
  })

  it('fires attempt 1 at 10 minutes', () => {
    expect(selectDueAttempt(params())).toBe(1)
  })

  it('does not repeat attempt 1 once it was sent for the version', () => {
    expect(selectDueAttempt(params({ attempt1SentForVersion: true }))).toBeNull()
  })

  it('does not send attempt 2 before 2 hours', () => {
    expect(
      selectDueAttempt(
        params({
          lastInboundAt: NOW - (RECOVERY_ATTEMPT_2_DELAY_MS - 1000),
          attempt1SentForVersion: true,
        })
      )
    ).toBeNull()
  })

  it('fires attempt 2 at 2 hours only when attempt 1 was sent', () => {
    expect(
      selectDueAttempt(
        params({
          lastInboundAt: NOW - RECOVERY_ATTEMPT_2_DELAY_MS,
          attempt1SentForVersion: true,
        })
      )
    ).toBe(2)
  })

  it('does not jump straight to attempt 2 when attempt 1 was missed', () => {
    expect(
      selectDueAttempt(
        params({
          lastInboundAt: NOW - RECOVERY_ATTEMPT_2_DELAY_MS,
          attempt1SentForVersion: false,
        })
      )
    ).toBeNull()
  })

  it('never sends more than two attempts', () => {
    expect(
      selectDueAttempt(
        params({
          lastInboundAt: NOW - 3 * HOUR,
          attempt1SentForVersion: true,
          attempt2SentForVersion: true,
        })
      )
    ).toBeNull()
  })

  it('never recovers beyond the 24h ceiling', () => {
    expect(
      selectDueAttempt(
        params({
          lastInboundAt: NOW - RECOVERY_WINDOW_MS,
          attempt1SentForVersion: true,
        })
      )
    ).toBeNull()
  })

  it('resets when a new inbound message shifts the version back before 10 minutes', () => {
    // A fresh customer message means lastInboundAt moves forward; even though a
    // previous version had attempt 1 (and 2) sent, the new version starts clean.
    expect(
      selectDueAttempt({
        now: NOW,
        lastInboundAt: NOW - 2 * MIN,
        attempt1SentForVersion: false,
        attempt2SentForVersion: false,
      })
    ).toBeNull()
  })
})
