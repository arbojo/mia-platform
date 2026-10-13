import { describe, it, expect } from 'vitest'

import {
  isHumanTakeoverCommand,
  matchHumanTakeoverCommand,
  stripHumanTakeoverToken,
} from './human-takeover.js'

/**
 * The `#e` token makes MIA take the conversation back (resume). It counts when
 * it is the WHOLE message or the LAST token of a message, so the salesperson can
 * append it to a real reply (`bla bla #e`). A token placed mid-sentence never
 * triggers. It is case/whitespace tolerant so it can be typed fast; trailing
 * punctuation is allowed. The token is stripped from the forwarded content and
 * the message is never deleted.
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

  it('matches the token at the end of a real message', () => {
    expect(isHumanTakeoverCommand('bla bla bla #e', '#e')).toBe(true)
    expect(isHumanTakeoverCommand('te comparto el catálogo #E', '#e')).toBe(true)
  })

  it('tolerates trailing punctuation after the token', () => {
    expect(isHumanTakeoverCommand('bla bla #e.', '#e')).toBe(true)
    expect(isHumanTakeoverCommand('listo #e!', '#e')).toBe(true)
  })

  it('does not fire when the token sits mid-sentence', () => {
    expect(isHumanTakeoverCommand('confirmo #e 2 cajas', '#e')).toBe(false)
    expect(isHumanTakeoverCommand('#e bla bla', '#e')).toBe(false)
  })

  it('does not fire on a word that merely contains the token', () => {
    expect(isHumanTakeoverCommand('#enviar el pedido', '#e')).toBe(false)
    expect(isHumanTakeoverCommand('bla#e', '#e')).toBe(false)
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

describe('stripHumanTakeoverToken', () => {
  it('removes a trailing token and trims the result', () => {
    expect(stripHumanTakeoverToken('bla bla bla #e', '#e')).toBe('bla bla bla')
    expect(stripHumanTakeoverToken('bla bla #e.', '#e')).toBe('bla bla')
  })

  it('returns empty content for a bare token', () => {
    expect(stripHumanTakeoverToken('  #e  ', '#e')).toBe('')
  })

  it('leaves the content untouched when there is no token', () => {
    expect(stripHumanTakeoverToken('confirmo #e 2 cajas', '#e')).toBe('confirmo #e 2 cajas')
  })
})

describe('matchHumanTakeoverCommand', () => {
  it('reports matched + stripped in one pass', () => {
    expect(matchHumanTakeoverCommand('hola #e', '#e')).toEqual({ matched: true, stripped: 'hola' })
    expect(matchHumanTakeoverCommand('hola', '#e')).toEqual({ matched: false, stripped: 'hola' })
  })
})
