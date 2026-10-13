import { describe, it, expect } from 'vitest'
import {
  decideOutboundPauseState,
  isHumanTakeoverEnabled,
  isRecoveryResumeMessage,
  nextAiPausedAt,
  shouldStaySilentForHumanTakeover,
} from '../../src/lib/runtime/human-takeover'

const RECOVERY = [
  '👋 Hola, ¿aún sigues interesado? 😍',
  '🚚 Aprovecha que  el envío es totalmente GRATIS',
  '💵 Pagas al recibir, sin riesgos',
  '⚠️ ¡Últimas piezas disponibles!',
  '',
  '✨ Aprovecha y agenda tu pedido HOY mismo antes de que se terminen 🙌💜',
  '',
  'https://mia-platform-psi.vercel.app/catalogo',
].join('\n')

/**
 * Human takeover: a business-side human replying pauses MIA in that
 * conversation only, and the `#e` token takes it back (`resume` clears the
 * pause; `toggle` flips it — legacy).
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

  it('always resumes on the #e resume command', () => {
    expect(nextAiPausedAt('resume', '2026-10-11T11:00:00.000Z', now)).toBeNull()
    expect(nextAiPausedAt('resume', null, now)).toBeNull()
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

describe('isRecoveryResumeMessage', () => {
  it('matches the recovery message exactly', () => {
    expect(isRecoveryResumeMessage(RECOVERY)).toBe(true)
  })

  it('matches despite whitespace, line breaks and accent variations', () => {
    const messy =
      'Hola, aun   sigues interesado\n\nAprovecha que el envio es totalmente gratis. ' +
      'Pagas al recibir, sin riesgos. Ultimas piezas disponibles! ' +
      'Aprovecha y agenda tu pedido hoy mismo antes de que se terminen ' +
      'https://mia-platform-psi.vercel.app/catalogo'
    expect(isRecoveryResumeMessage(messy)).toBe(true)
  })

  it('matches with the emojis stripped out', () => {
    const noEmoji = RECOVERY.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\uFE0F]/gu, '')
    expect(isRecoveryResumeMessage(noEmoji)).toBe(true)
  })

  it('does NOT match an edited recovery copy', () => {
    const edited = RECOVERY.replace(
      '¿aún sigues interesado?',
      '¿aún sigues interesado en nuestros productos?'
    )
    expect(isRecoveryResumeMessage(edited)).toBe(false)
  })

  it('does NOT match a customer quoting a single line', () => {
    expect(isRecoveryResumeMessage('¿aún sigues interesado?')).toBe(false)
  })

  it('does NOT match an unrelated human message', () => {
    expect(isRecoveryResumeMessage('Hola, te comparto el catálogo de Vitanova.')).toBe(false)
  })
})

describe('decideOutboundPauseState', () => {
  const now = '2026-10-11T12:00:00.000Z'

  it('pauses on a plain human message', () => {
    expect(decideOutboundPauseState({ content: 'Va, te comparto info', currentAiPausedAt: null, now })).toBe(now)
  })

  it('refreshes the pause while the human keeps writing', () => {
    expect(
      decideOutboundPauseState({
        content: 'Otra cosa más',
        currentAiPausedAt: '2026-10-11T11:00:00.000Z',
        now,
      })
    ).toBe(now)
  })

  it('resumes on the recovery message', () => {
    expect(
      decideOutboundPauseState({
        content: RECOVERY,
        currentAiPausedAt: '2026-10-11T11:00:00.000Z',
        now,
      })
    ).toBeNull()
  })

  it('stays resumed on the recovery message when not paused', () => {
    expect(decideOutboundPauseState({ content: RECOVERY, currentAiPausedAt: null, now })).toBeNull()
  })

  it('lets the #e toggle win regardless of content', () => {
    expect(
      decideOutboundPauseState({
        command: 'toggle',
        content: '#e',
        currentAiPausedAt: '2026-10-11T11:00:00.000Z',
        now,
      })
    ).toBeNull()
    expect(
      decideOutboundPauseState({ command: 'toggle', content: '#e', currentAiPausedAt: null, now })
    ).toBe(now)
  })

  it('resumes on the #e resume command regardless of content and state', () => {
    expect(
      decideOutboundPauseState({
        command: 'resume',
        content: 'bla bla #e',
        currentAiPausedAt: '2026-10-11T11:00:00.000Z',
        now,
      })
    ).toBeNull()
    expect(
      decideOutboundPauseState({ command: 'resume', content: 'bla bla #e', currentAiPausedAt: null, now })
    ).toBeNull()
  })
})
