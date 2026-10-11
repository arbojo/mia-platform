import { describe, it, expect } from 'vitest'
import {
  isHumanTakeoverEnabled,
  nextAiPausedAt,
  shouldStaySilentForHumanTakeover,
} from '../../src/lib/runtime/human-takeover'

/**
 * Human takeover: a business-side human replying pauses MIA in that
 * conversation only, and the `#e` token toggles the state.
 *
 * The decisions are pure so they can be pinned without a database. The two
 * silent-failure modes are (a) a normal human message that fails to pause, which
 * lets MIA talk over the salesperson, and (b) a customer message that fails to
 * be swallowed while paused, which answers on the human's behalf.
 */
describe('human takeover — feature gate', () => {
  it('is enabled by default', () => {
    expect(isHumanTakeoverEnabled({} as unknown as NodeJS.ProcessEnv)).toBe(true)
  })

  it('is disabled only by the explicit "0" rollback flag', () => {
    expect(
      isHumanTakeoverEnabled({ HUMAN_TAKEOVER_ENABLED: '0' } as unknown as NodeJS.ProcessEnv)
    ).toBe(false)
    expect(
      isHumanTakeoverEnabled({ HUMAN_TAKEOVER_ENABLED: '1' } as unknown as NodeJS.ProcessEnv)
    ).toBe(true)
  })
})

describe('nextAiPausedAt', () => {
  const now = '2026-10-11T12:00:00.000Z'

  it('pauses on a plain human message', () => {
    expect(nextAiPausedAt(undefined, null, now)).toBe(now)
  })

  it('refreshes the pause while the human keeps writing', () => {
    expect(nextAiPausedAt(undefined, '2026-10-11T11:00:00.000Z', now)).toBe(now)
  })

  it('resumes when toggled while paused', () => {
    expect(nextAiPausedAt('toggle', '2026-10-11T11:00:00.000Z', now)).toBeNull()
  })

  it('pauses when toggled while active', () => {
    expect(nextAiPausedAt('toggle', null, now)).toBe(now)
  })
})

describe('shouldStaySilentForHumanTakeover', () => {
  it('swallows the customer message while paused', () => {
    expect(shouldStaySilentForHumanTakeover(true, '2026-10-11T11:00:00.000Z')).toBe(true)
  })

  it('answers when the conversation was never paused', () => {
    expect(shouldStaySilentForHumanTakeover(true, null)).toBe(false)
    expect(shouldStaySilentForHumanTakeover(true, undefined)).toBe(false)
  })

  it('answers while the feature is disabled even if a stale pause exists', () => {
    expect(shouldStaySilentForHumanTakeover(false, '2026-10-11T11:00:00.000Z')).toBe(false)
  })
})
