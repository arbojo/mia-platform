import { describe, it, expect } from 'vitest'

import { isHumanTakeoverCommand } from './human-takeover.js'

/**
 * The token toggles MIA on/off for a conversation. It must be the WHOLE message
 * so a `#e` typed inside a real sentence never flips the state, and it must be
 * case/whitespace tolerant so the salesperson can write it fast from the phone.
 */
describe('isHumanTakeoverCommand', () => {
  it('matches the bare token', () => {
    expect(isHumanTakeoverCommand('#e', '#e')).toBe(true)
  })

  it('ignores surrounding whitespace', () => {
    expect(isHumanTakeoverCommand('  #e  ', '#e')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isHumanTakeoverCommand('#E', '#e')).toBe(true)
  })

  it('honours a custom token', () => {
    expect(isHumanTakeoverCommand('#r', '#r')).toBe(true)
    expect(isHumanTakeoverCommand('#e', '#r')).toBe(false)
  })

  it('does not fire when the token sits inside a normal message', () => {
    expect(isHumanTakeoverCommand('ya te mando el #e del pedido', '#e')).toBe(false)
    expect(isHumanTakeoverCommand('va, confirmo #e 2 cajas', '#e')).toBe(false)
  })

  it('does not fire on empty content', () => {
    expect(isHumanTakeoverCommand('', '#e')).toBe(false)
    expect(isHumanTakeoverCommand('   ', '#e')).toBe(false)
  })

  it('never fires with an empty token', () => {
    expect(isHumanTakeoverCommand('', '')).toBe(false)
    expect(isHumanTakeoverCommand('#e', '   ')).toBe(false)
  })
})
