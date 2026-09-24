import { canServeTraffic } from '@/lib/runtime/assistant-gate'

export type PresenceState = 'active' | 'learning' | 'paused'

export interface AssistantPresenceSource {
  id: string | null
  is_active: boolean
  status: string | null
}

/**
 * Derives the dashboard presence state from the assistant's real storage state.
 *
 * - active    → assistant serves traffic (is_active + status ∈ ready/active)
 * - learning  → assistant exists but is in training/draft (not serving, learning)
 * - paused    → assistant is explicitly deactivated (is_active=false) or missing
 */
export function derivePresence(source: AssistantPresenceSource | null): PresenceState {
  if (!source) return 'paused'
  if (!source.is_active) return 'paused'
  if (canServeTraffic(source.is_active, source.status)) return 'active'
  if (source.status === 'training' || source.status === 'draft') return 'learning'
  return 'paused'
}

/**
 * Maps a presence state back to the assistant fields the PATCH endpoint accepts.
 * Reuses the exact same status/is_active vocabulary as AssistantConfig.
 */
export function presenceToAssistantUpdate(presence: PresenceState): {
  status: 'active' | 'training' | 'inactive'
  is_active: boolean
} {
  switch (presence) {
    case 'active':
      return { status: 'active', is_active: true }
    case 'learning':
      return { status: 'training', is_active: true }
    case 'paused':
      return { status: 'inactive', is_active: false }
  }
}