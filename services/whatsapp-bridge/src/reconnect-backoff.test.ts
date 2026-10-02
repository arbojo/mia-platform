import { describe, it, expect } from 'vitest'
import { ReconnectBackoff } from './reconnect-backoff.js'

const BASE = 5_000
const MAX = 300_000
const CEILING = 8

const makeBackoff = (ceiling = CEILING): ReconnectBackoff =>
  new ReconnectBackoff(BASE, MAX, ceiling)

describe('ReconnectBackoff', () => {
  it('starts at attempt 1', () => {
    const backoff = makeBackoff()
    expect(backoff.fail('b1')).toBe(1)
  })

  // The regression this exists for: the counter used to live on ActiveSession,
  // which the close handler removed from the map before recording the failure.
  // Every cycle therefore restarted at 1 and the delay stayed pinned at the
  // base value, hot-looping the bridge against a closing stream.
  it('escalates across repeated failures of the same business', () => {
    const backoff = makeBackoff()
    expect([1, 2, 3, 4, 5].map(() => backoff.fail('b1'))).toEqual([1, 2, 3, 4, 5])
  })

  it('keeps the delay growing while the socket dies immediately', () => {
    const backoff = makeBackoff()
    const observed: number[] = []
    for (let i = 0; i < 4; i++) {
      observed.push(backoff.delayFor(backoff.fail('b1')))
    }
    expect(observed).toEqual([5_000, 10_000, 20_000, 40_000])
  })

  it('saturates the delay at the maximum', () => {
    const backoff = makeBackoff()
    expect(backoff.delayFor(20)).toBe(MAX)
  })

  it('counts businesses independently', () => {
    const backoff = makeBackoff()
    backoff.fail('b1')
    backoff.fail('b1')
    expect(backoff.fail('b2')).toBe(1)
    expect(backoff.current('b1')).toBe(2)
    expect(backoff.current('b2')).toBe(1)
  })

  it('reports zero for an unknown business', () => {
    expect(makeBackoff().current('nope')).toBe(0)
  })

  // A socket that reached `open` and died seconds later is not a recovery, so
  // only a connection that held long enough calls recover().
  it('restarts the countdown only after an explicit recovery', () => {
    const backoff = makeBackoff()
    backoff.fail('b1')
    backoff.fail('b1')
    backoff.recover('b1')
    expect(backoff.current('b1')).toBe(0)
    expect(backoff.fail('b1')).toBe(1)
  })

  it('allows exactly maxAttempts retries then gives up', () => {
    const backoff = makeBackoff()
    for (let i = 0; i < CEILING; i++) {
      const attempt = backoff.fail('b1')
      expect(backoff.exceeded(attempt)).toBe(false)
      expect(backoff.giveUpReason(attempt)).toBeNull()
    }
    const finalAttempt = backoff.fail('b1')
    expect(backoff.exceeded(finalAttempt)).toBe(true)
    expect(backoff.giveUpReason(finalAttempt)).toContain(`after ${CEILING} reconnect attempts`)
  })

  it('gives up with no further delay scheduled', () => {
    const backoff = makeBackoff()
    const reason = backoff.giveUpReason(CEILING + 1)
    expect(reason).not.toBeNull()
    expect(reason).toContain(`${MAX}ms`)
  })

  it('starts fresh once the caller recovers after giving up', () => {
    const backoff = makeBackoff()
    for (let i = 0; i <= CEILING; i++) backoff.fail('b1')
    // SessionManager calls recover() on the give-up branch, so an operator
    // retry does not inherit an exhausted counter.
    backoff.recover('b1')
    expect(backoff.fail('b1')).toBe(1)
    expect(backoff.exceeded(1)).toBe(false)
  })
})