/**
 * Human takeover — pure decision helpers.
 *
 * A business-side human replying in a conversation pauses MIA for THAT
 * conversation (see conversations.ai_paused_at). The `#e` command toggles the
 * state. All persistence lives in the runtime; the decisions are kept here so
 * they are unit-testable without a database.
 */

export function isHumanTakeoverEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.HUMAN_TAKEOVER_ENABLED !== '0'
}

/**
 * The value `conversations.ai_paused_at` must be set to for a human outbound.
 * `toggle` flips the current state (pause <-> resume); a plain message always
 * pauses (refreshing the instant while the human keeps writing).
 */
export function nextAiPausedAt(
  command: 'toggle' | undefined,
  currentAiPausedAt: string | null,
  now: string = new Date().toISOString()
): string | null {
  if (command === 'toggle') {
    return currentAiPausedAt ? null : now
  }
  return now
}

/**
 * Whether an inbound CUSTOMER message must be swallowed (persisted for context
 * but never answered) because a human currently owns the conversation.
 */
export function shouldStaySilentForHumanTakeover(
  enabled: boolean,
  aiPausedAt: string | null | undefined
): boolean {
  return enabled && Boolean(aiPausedAt)
}
