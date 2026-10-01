import type { ChannelMode } from './types'

/**
 * Whether a channel mode is allowed to produce REAL commercial side effects
 * (sales_events, delivery orders, inventory movements, sends).
 *
 * `shadow` means "MIA thinks, learns and drafts, but the world must not move",
 * so a hypothetical SALE_WON must never reach `processSaleClosing` — the
 * delivery and inventory triggers would otherwise turn it into a real order a
 * driver could act on. `paused` short-circuits in the runtime before the Core,
 * but is included here so the rule stays correct if that ever changes.
 *
 * `undefined` means "no channel behind this turn" (Web Chat, training,
 * laboratorio) and deliberately keeps the legacy deliver behaviour. Callers that
 * resolved a connection should always pass the real mode.
 */
export function allowsSideEffects(mode: ChannelMode | null | undefined): boolean {
  if (mode === undefined || mode === null) return true
  return mode !== 'shadow' && mode !== 'paused'
}